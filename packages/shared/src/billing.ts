/** Status públicos da intenção de contratação (landing). */
export type PublicIntentStatus =
  | "PROCESSING"
  | "ACTIVE"
  | "CANCELED"
  | "EXPIRED"
  | "FAILED"
  | "PENDING";

export type PublicIntentNextAction =
  | "WAIT"
  | "SET_PASSWORD"
  | "OPEN_CHECKOUT"
  | "RETRY"
  | "LOGIN"
  | "ENTER_APP"
  | "NONE";

/** Status internos persistidos em CheckoutIntent.status */
export const CHECKOUT_INTENT_STATUSES = [
  "CREATED",
  "CHECKOUT_CREATED",
  "PAYMENT_PROCESSING",
  "COMPLETED",
  "EXPIRED",
  "CANCELED",
  "FAILED",
] as const;

export type CheckoutIntentStatus = (typeof CHECKOUT_INTENT_STATUSES)[number];

export function isCheckoutIntentStatus(
  value: string,
): value is CheckoutIntentStatus {
  return (CHECKOUT_INTENT_STATUSES as readonly string[]).includes(value);
}

export function mapIntentToPublicStatus(status: string): PublicIntentStatus {
  switch (status) {
    case "COMPLETED":
      return "ACTIVE";
    case "CANCELED":
      return "CANCELED";
    case "EXPIRED":
      return "EXPIRED";
    case "FAILED":
      return "FAILED";
    case "PAYMENT_PROCESSING":
      return "PROCESSING";
    case "CHECKOUT_CREATED":
    case "CREATED":
    default:
      return "PENDING";
  }
}
