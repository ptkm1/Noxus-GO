import type {
  OrganizationAccessStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../../db.js";
import { readAsaasConfig } from "./asaas/asaas-config.js";

export const TRIAL_EXPIRED_MESSAGE =
  "Período de teste encerrado. Assine para continuar usando o sistema.";

export type OrgAccessSnapshot = {
  accessStatus: OrganizationAccessStatus;
  suspended: boolean;
  pendingPayment: boolean;
  canUseApp: boolean;
  message: string | null;
};

export type OrgSubscriptionAccessInput = {
  status: SubscriptionStatus;
  gracePeriodEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
};

export type OrgAccessEvaluation = OrgAccessSnapshot & {
  nextAccessStatus: OrganizationAccessStatus;
  nextSubscriptionStatus: Extract<
    SubscriptionStatus,
    "SUSPENDED" | "CANCELED"
  > | null;
};

function isTrialStillValid(
  sub: OrgSubscriptionAccessInput,
  nowMs: number,
): boolean {
  const end = sub.currentPeriodEnd?.getTime();
  return Boolean(end && end > nowMs);
}

function accessMessage(
  accessStatus: OrganizationAccessStatus,
  pendingPayment: boolean,
  trialExpired: boolean,
): string | null {
  if (pendingPayment) {
    return trialExpired
      ? TRIAL_EXPIRED_MESSAGE
      : "Pagamento pendente. Conclua a contratação para acessar o sistema.";
  }
  if (accessStatus === "SUSPENDED") {
    return "O acesso desta organização está temporariamente indisponível. Entre em contato com o administrador da empresa.";
  }
  if (accessStatus === "CANCELED") {
    return "Assinatura cancelada. Entre em contato com o suporte.";
  }
  if (accessStatus === "PAST_DUE") {
    return "Há uma pendência de pagamento. Regularize para evitar a suspensão.";
  }
  return null;
}

/**
 * Resolve acesso da org a partir da assinatura (sem I/O).
 * Trial ativo (`TRIAL` + `currentPeriodEnd` no futuro, UTC) → canUseApp.
 * Trial expirado → PENDING_PAYMENT (paywall), dados preservados.
 */
export function evaluateOrgAccess(input: {
  accessStatus: OrganizationAccessStatus;
  subscription: OrgSubscriptionAccessInput | null;
  now?: Date;
}): OrgAccessEvaluation {
  const nowMs = (input.now ?? new Date()).getTime();
  let accessStatus = input.accessStatus;
  let nextSubscriptionStatus: OrgAccessEvaluation["nextSubscriptionStatus"] =
    null;
  const sub = input.subscription;

  if (sub?.status === "ACTIVE" && accessStatus === "PENDING_PAYMENT") {
    accessStatus = "ACTIVE";
  }

  if (sub?.status === "TRIAL") {
    if (isTrialStillValid(sub, nowMs)) {
      if (accessStatus !== "ACTIVE") accessStatus = "ACTIVE";
    } else {
      accessStatus = "PENDING_PAYMENT";
    }
  }

  if (
    accessStatus === "PAST_DUE" &&
    sub?.gracePeriodEndsAt &&
    sub.gracePeriodEndsAt.getTime() < nowMs
  ) {
    accessStatus = "SUSPENDED";
    nextSubscriptionStatus = "SUSPENDED";
  }

  if (
    sub?.status !== "TRIAL" &&
    sub?.cancelAtPeriodEnd &&
    sub.currentPeriodEnd &&
    sub.currentPeriodEnd.getTime() < nowMs &&
    accessStatus === "ACTIVE"
  ) {
    accessStatus = "CANCELED";
    nextSubscriptionStatus = "CANCELED";
  }

  const pendingPayment = accessStatus === "PENDING_PAYMENT";
  const suspended = accessStatus === "SUSPENDED" || accessStatus === "CANCELED";
  const canUse = accessStatus === "ACTIVE" || accessStatus === "PAST_DUE";
  const message = accessMessage(
    accessStatus,
    pendingPayment,
    pendingPayment && sub?.status === "TRIAL",
  );

  return {
    accessStatus,
    nextAccessStatus: accessStatus,
    nextSubscriptionStatus,
    suspended,
    pendingPayment,
    canUseApp: canUse,
    message,
  };
}

/** Aplica grace period, expiração de trial e cancelamento ao fim do período. */
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

  const evaluated = evaluateOrgAccess({
    accessStatus: org.accessStatus,
    subscription: org.subscription,
  });

  if (evaluated.nextAccessStatus !== org.accessStatus) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { accessStatus: evaluated.nextAccessStatus },
    });
  }

  if (evaluated.nextSubscriptionStatus) {
    await prisma.organizationSubscription.updateMany({
      where: { organizationId },
      data: { status: evaluated.nextSubscriptionStatus },
    });
  }

  return {
    accessStatus: evaluated.accessStatus,
    suspended: evaluated.suspended,
    pendingPayment: evaluated.pendingPayment,
    canUseApp: evaluated.canUseApp,
    message: evaluated.message,
  };
}

export function gracePeriodEndFromNow(): Date {
  const cfg = readAsaasConfig();
  const days = cfg?.gracePeriodDays ?? 7;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
