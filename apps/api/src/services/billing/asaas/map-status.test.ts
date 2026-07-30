import { describe, expect, it } from "vitest";
import {
  mapAsaasPaymentEventToInternalStatus,
  normalizeAsaasSubscriptionStatus,
  subscriptionStatusToAccessStatus,
} from "./map-status.js";

describe("mapAsaasPaymentEventToInternalStatus", () => {
  it("ativa em PAYMENT_CONFIRMED e CHECKOUT_PAID", () => {
    expect(mapAsaasPaymentEventToInternalStatus("PAYMENT_CONFIRMED")).toBe(
      "activate",
    );
    expect(mapAsaasPaymentEventToInternalStatus("CHECKOUT_PAID")).toBe(
      "activate",
    );
  });

  it("mapeia inadimplência e cancelamento", () => {
    expect(mapAsaasPaymentEventToInternalStatus("PAYMENT_OVERDUE")).toBe(
      "past_due",
    );
    expect(mapAsaasPaymentEventToInternalStatus("SUBSCRIPTION_DELETED")).toBe(
      "canceled",
    );
    expect(mapAsaasPaymentEventToInternalStatus("CHECKOUT_EXPIRED")).toBe(
      "expired",
    );
  });

  it("ignora eventos desconhecidos", () => {
    expect(mapAsaasPaymentEventToInternalStatus("PAYMENT_CREATED")).toBe(
      "ignore",
    );
  });
});

describe("normalizeAsaasSubscriptionStatus", () => {
  it("normaliza status Asaas", () => {
    expect(normalizeAsaasSubscriptionStatus("ACTIVE")).toBe("ACTIVE");
    expect(normalizeAsaasSubscriptionStatus("INACTIVE")).toBe("SUSPENDED");
    expect(normalizeAsaasSubscriptionStatus("DELETED")).toBe("CANCELED");
    expect(normalizeAsaasSubscriptionStatus(null)).toBeNull();
  });
});

describe("subscriptionStatusToAccessStatus", () => {
  it("converte status de assinatura para acesso da org", () => {
    expect(subscriptionStatusToAccessStatus("ACTIVE")).toBe("ACTIVE");
    expect(subscriptionStatusToAccessStatus("INCOMPLETE")).toBe(
      "PENDING_PAYMENT",
    );
    expect(subscriptionStatusToAccessStatus("PAST_DUE")).toBe("PAST_DUE");
    expect(subscriptionStatusToAccessStatus("SUSPENDED")).toBe("SUSPENDED");
  });
});
