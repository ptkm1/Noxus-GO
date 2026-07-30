import type { OrganizationAccessStatus } from "@prisma/client";
import { prisma } from "../../db.js";
import { readAsaasConfig } from "./asaas/asaas-config.js";

export type OrgAccessSnapshot = {
  accessStatus: OrganizationAccessStatus;
  suspended: boolean;
  pendingPayment: boolean;
  canUseApp: boolean;
  message: string | null;
};

/** Aplica grace period → SUSPENDED se necessário. */
export async function syncOrgAccessFromSubscription(
  organizationId: string,
): Promise<OrgAccessSnapshot> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      accessStatus: true,
      subscription: {
        select: {
          status: true,
          gracePeriodEndsAt: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: true,
        },
      },
    },
  });

  if (!org) {
    return {
      accessStatus: "SUSPENDED",
      suspended: true,
      pendingPayment: false,
      canUseApp: false,
      message: "Organização não encontrada.",
    };
  }

  let accessStatus = org.accessStatus;
  const sub = org.subscription;
  const now = Date.now();

  if (
    accessStatus === "PAST_DUE" &&
    sub?.gracePeriodEndsAt &&
    sub.gracePeriodEndsAt.getTime() < now
  ) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { accessStatus: "SUSPENDED" },
    });
    await prisma.organizationSubscription.updateMany({
      where: { organizationId },
      data: { status: "SUSPENDED" },
    });
    accessStatus = "SUSPENDED";
  }

  if (
    sub?.cancelAtPeriodEnd &&
    sub.currentPeriodEnd &&
    sub.currentPeriodEnd.getTime() < now &&
    accessStatus === "ACTIVE"
  ) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { accessStatus: "CANCELED" },
    });
    await prisma.organizationSubscription.updateMany({
      where: { organizationId },
      data: { status: "CANCELED" },
    });
    accessStatus = "CANCELED";
  }

  const pendingPayment = accessStatus === "PENDING_PAYMENT";
  const suspended = accessStatus === "SUSPENDED" || accessStatus === "CANCELED";
  const canUse = accessStatus === "ACTIVE" || accessStatus === "PAST_DUE";

  let message: string | null = null;
  if (pendingPayment) {
    message =
      "Pagamento pendente. Conclua a contratação para acessar o sistema.";
  } else if (accessStatus === "SUSPENDED") {
    message =
      "O acesso desta organização está temporariamente indisponível. Entre em contato com o administrador da empresa.";
  } else if (accessStatus === "CANCELED") {
    message = "Assinatura cancelada. Entre em contato com o suporte.";
  } else if (accessStatus === "PAST_DUE") {
    message =
      "Há uma pendência de pagamento. Regularize para evitar a suspensão.";
  }

  return {
    accessStatus,
    suspended,
    pendingPayment,
    canUseApp: canUse,
    message,
  };
}

export function gracePeriodEndFromNow(): Date {
  const cfg = readAsaasConfig();
  const days = cfg?.gracePeriodDays ?? 7;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
