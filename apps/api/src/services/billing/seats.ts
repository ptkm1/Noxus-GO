import {
    extraAdminCount,
    getPlanDefinition,
    planMonthlyTotal,
    type PlanId,
} from "@pedidos/shared";
import { prisma } from "../../db.js";
import { PaymentGatewayError } from "./payment-gateway.js";
import { resolvePaymentGateway } from "./resolve-payment-gateway.js";

const ADMIN_ROLES = ["ADMIN", "MANAGER"] as const;

export async function countPendingInvites(
  organizationId: string,
): Promise<number> {
  const now = new Date();
  return prisma.accountActivationToken.count({
    where: {
      purpose: "USER_INVITE",
      usedAt: null,
      expiresAt: { gt: now },
      user: { organizationId, role: { in: [...ADMIN_ROLES] } },
    },
  });
}

export async function countBillableSeats(organizationId: string): Promise<{
  sellerCount: number;
  adminCount: number;
}> {
  const [sellerCount, adminCount] = await Promise.all([
    prisma.seller.count({ where: { organizationId } }),
    prisma.user.count({
      where: { organizationId, role: { in: [...ADMIN_ROLES] } },
    }),
  ]);
  return { sellerCount, adminCount };
}

export async function countUsedSeats(organizationId: string): Promise<{
  usedSeats: number;
  activeUsers: number;
  pendingInvites: number;
  includedAdmins: number;
  extraAdmins: number;
}> {
  const [activeUsers, pendingInvites, sub, seats] = await Promise.all([
    prisma.user.count({
      where: {
        organizationId,
        role: { in: [...ADMIN_ROLES] },
        activatedAt: { not: null },
      },
    }),
    countPendingInvites(organizationId),
    prisma.organizationSubscription.findUnique({
      where: { organizationId },
      select: { planId: true },
    }),
    countBillableSeats(organizationId),
  ]);
  const includedAdmins = getPlanDefinition(sub?.planId).limits.includedAdmins;
  return {
    usedSeats: activeUsers + pendingInvites,
    activeUsers,
    pendingInvites,
    includedAdmins,
    extraAdmins: extraAdminCount(seats.adminCount, includedAdmins),
  };
}

export async function resolveCheckoutAmountBrl(
  planId: PlanId,
  organizationId: string,
  isPlanChange: boolean,
): Promise<number> {
  const def = getPlanDefinition(planId);
  if (!isPlanChange) return def.monthlyPriceBrl;
  const { sellerCount, adminCount } = await countBillableSeats(organizationId);
  return planMonthlyTotal(planId, sellerCount, adminCount);
}

export type SyncSubscriptionSeatsOpts = {
  extraSellers?: number;
  extraAdmins?: number;
};

/**
 * Recalcula o valor mensal (base + vendedores + admins extras) e atualiza
 * a assinatura no gateway quando houver cobrança Asaas/fake ativa.
 */
export async function syncSubscriptionSeats(
  organizationId: string,
  opts?: SyncSubscriptionSeatsOpts,
): Promise<{ totalBrl: number; updated: boolean }> {
  const extraSellers = opts?.extraSellers ?? 0;
  const extraAdmins = opts?.extraAdmins ?? 0;
  const { sellerCount, adminCount } = await countBillableSeats(organizationId);
  const projectedSellers = Math.max(0, sellerCount + extraSellers);
  const projectedAdmins = Math.max(0, adminCount + extraAdmins);

  const sub = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    select: {
      planId: true,
      status: true,
      provider: true,
      providerSubscriptionId: true,
    },
  });
  if (!sub) {
    return { totalBrl: 0, updated: false };
  }

  const totalBrl = planMonthlyTotal(
    sub.planId,
    projectedSellers,
    projectedAdmins,
  );
  const increasing = extraSellers > 0 || extraAdmins > 0;
  const canCharge =
    Boolean(sub.providerSubscriptionId) &&
    (sub.provider === "asaas" || sub.provider === "fake") &&
    (sub.status === "ACTIVE" || sub.status === "TRIAL");

  if (!canCharge || !sub.providerSubscriptionId) {
    return { totalBrl, updated: false };
  }

  const gw = resolvePaymentGateway();
  if (!gw) {
    if (increasing) {
      throw Object.assign(
        new Error("Não foi possível atualizar a cobrança dos assentos"),
        { code: "BILLING_SEAT_UPDATE_FAILED", http: 503 },
      );
    }
    return { totalBrl, updated: false };
  }

  const def = getPlanDefinition(sub.planId);
  try {
    await gw.updateSubscriptionValue({
      subscriptionId: sub.providerSubscriptionId,
      value: totalBrl,
      description: `Assinatura PedixPro — Plano ${def.name} (${projectedSellers} vendedor(es), ${projectedAdmins} acesso(s) administrativo(s))`,
      updatePendingPayments: increasing,
    });
  } catch (err) {
    if (increasing) {
      const message =
        err instanceof PaymentGatewayError
          ? err.message
          : "Não foi possível atualizar a cobrança dos assentos";
      throw Object.assign(new Error(message), {
        code: "BILLING_SEAT_UPDATE_FAILED",
        http: err instanceof PaymentGatewayError ? err.status ?? 502 : 502,
      });
    }
    return { totalBrl, updated: false };
  }

  return { totalBrl, updated: true };
}
