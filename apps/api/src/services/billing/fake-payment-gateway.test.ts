import { describe, expect, it } from "vitest";
import { FakePaymentGateway } from "./fake-payment-gateway.js";

describe("FakePaymentGateway", () => {
  it("cria customer e checkout recorrente", async () => {
    const gw = new FakePaymentGateway();
    const customer = await gw.createCustomer({
      name: "ACME",
      email: "a@b.com",
      cpfCnpj: "11222333000181",
      externalReference: "org_1",
    });
    const checkout = await gw.createSubscriptionCheckout({
      customerId: customer.id,
      items: [{ name: "Pro", quantity: 1, value: 199 }],
      cycle: "MONTHLY",
      nextDueDate: "2026-08-01",
      minutesToExpire: 60,
      externalReference: "intent_1",
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/cancel",
      expiredUrl: "https://example.com/expired",
    });
    expect(customer.id).toMatch(/^cus_fake_/);
    expect(checkout.link).toContain("sandbox.asaas.com");
    expect(gw.checkouts).toHaveLength(1);
  });

  it("registra cancelamento", async () => {
    const gw = new FakePaymentGateway();
    await gw.cancelSubscription("sub_1");
    expect(gw.canceled).toEqual(["sub_1"]);
  });
});
