import type {
  GatewayCustomer,
  GatewayCustomerInput,
  GatewaySubscriptionCheckout,
  GatewaySubscriptionCheckoutInput,
  PaymentGateway,
} from "./payment-gateway.js";

/** Gateway em memória para testes — sem HTTP. */
export class FakePaymentGateway implements PaymentGateway {
  customers: GatewayCustomerInput[] = [];
  checkouts: GatewaySubscriptionCheckoutInput[] = [];
  canceled: string[] = [];
  failNextCheckout = false;

  async createCustomer(input: GatewayCustomerInput): Promise<GatewayCustomer> {
    this.customers.push(input);
    return { id: `cus_fake_${this.customers.length}` };
  }

  async createSubscriptionCheckout(
    input: GatewaySubscriptionCheckoutInput,
  ): Promise<GatewaySubscriptionCheckout> {
    if (this.failNextCheckout) {
      this.failNextCheckout = false;
      throw new Error("checkout_failed");
    }
    this.checkouts.push(input);
    const id = `chk_fake_${this.checkouts.length}`;
    return {
      id,
      link: `https://sandbox.asaas.com/checkoutSession/show?id=${id}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    this.canceled.push(subscriptionId);
  }
}
