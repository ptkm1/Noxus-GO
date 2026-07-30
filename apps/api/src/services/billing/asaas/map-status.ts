import type {
  OrganizationAccessStatus,
  SubscriptionStatus,
} from "@prisma/client";

export type InternalPaymentEffect =
  | "activate"
  | "past_due"
  | "canceled"
  | "expired"
  | "ignore";

/** Cartão: ativar em PAYMENT_CONFIRMED (não esperar PAYMENT_RECEIVED). */
export function mapAsaasPaymentEventToInternalStatus(
  eventType: string,
): InternalPaymentEffect {
  switch (eventType) {
    case "PAYMENT_CONFIRMED":
    case "CHECKOUT_PAID":
      return "activate";
    case "PAYMENT_OVERDUE":
    case "PAYMENT_REPROVED_BY_RISK_ANALYSIS":
      return "past_due";
    case "PAYMENT_DELETED":
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_CHARGEBACK_DISPUTE":
    case "PAYMENT_AWAITING_CHARGEBACK_REVERSAL":
    case "CHECKOUT_CANCELED":
    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_INACTIVATED":
      return "canceled";
    case "CHECKOUT_EXPIRED":
      return "expired";
    default:
      return "ignore";
  }
}

export function normalizeAsaasSubscriptionStatus(
  asaasStatus: string | null | undefined,
): SubscriptionStatus | null {
  if (!asaasStatus) return null;
  const s = asaasStatus.toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "EXPIRED" || s === "DELETED") return "CANCELED";
  if (s === "INACTIVE") return "SUSPENDED";
  return null;
}

export function subscriptionStatusToAccessStatus(
  status: SubscriptionStatus,
): OrganizationAccessStatus {
  switch (status) {
    case "ACTIVE":
    case "TRIAL":
      return "ACTIVE";
    case "PAST_DUE":
      return "PAST_DUE";
    case "SUSPENDED":
      return "SUSPENDED";
    case "CANCELED":
      return "CANCELED";
    case "INCOMPLETE":
      return "PENDING_PAYMENT";
    default:
      return "ACTIVE";
  }
}
