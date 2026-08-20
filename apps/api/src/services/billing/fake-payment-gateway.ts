import { randomUUID } from "node:crypto";
import type {
  GatewayCustomer,
  GatewayCustomerInput,
  GatewaySubscriptionCheckout,
  GatewaySubscriptionCheckoutInput,
  PaymentGateway,
} from "./payment-gateway.js";

type FakeGatewayOpts = {
  checkoutLink?: (
    id: string,
    input: GatewaySubscriptionCheckoutInput,
  ) => string;
};

/** Gateway em memória para testes e `PAYMENT_GATEWAY=fake` — sem HTTP Asaas. */
export class FakePaymentGateway implements PaymentGateway {
  customers: GatewayCustomerInput[] = [];
  checkouts: GatewaySubscriptionCheckoutInput[] = [];
  canceled: string[] = [];
  failNextCheckout = false;

  constructor(private readonly opts: FakeGatewayOpts = {}) {}

  async createCustomer(input: GatewayCustomerInput): Promise<GatewayCustomer> {
    this.customers.push(input);
    return { id: `cus_fake_${randomUUID()}` };
  }

  async createSubscriptionCheckout(
    input: GatewaySubscriptionCheckoutInput,
  ): Promise<GatewaySubscriptionCheckout> {
    if (this.failNextCheckout) {
      this.failNextCheckout = false;
      throw new Error("checkout_failed");
    }
    this.checkouts.push(input);
    const id = `chk_fake_${randomUUID()}`;
    const link =
      this.opts.checkoutLink?.(id, input) ??
      `https://sandbox.asaas.com/checkoutSession/show?id=${id}`;
    return {
      id,
      link,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    this.canceled.push(subscriptionId);
  }
}
