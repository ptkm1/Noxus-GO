import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import type {
    GatewayCustomer,
    GatewayCustomerInput,
    GatewaySubscriptionChargeInput,
    GatewaySubscriptionChargeResult,
    GatewaySubscriptionChargeUpdateInput,
    GatewaySubscriptionCheckout,
    GatewaySubscriptionCheckoutInput,
    GatewaySubscriptionUpgradeInput,
    GatewaySubscriptionValueUpdateInput,
    GatewaySubscriptionWithCardInput,
    GatewaySubscriptionWithCardResult,
    PaymentGateway,
} from "./payment-gateway.js";

type FakeGatewayOpts = {
  checkoutLink?: (
    id: string,
    input: GatewaySubscriptionCheckoutInput,
  ) => string;
};

/** Gateway em memória só para testes unitários — sem HTTP Asaas. */
export class FakePaymentGateway implements PaymentGateway {
  customers: GatewayCustomerInput[] = [];
  checkouts: GatewaySubscriptionCheckoutInput[] = [];
  cardSubscriptions: GatewaySubscriptionWithCardInput[] = [];
  subscriptionUpgrades: GatewaySubscriptionUpgradeInput[] = [];
  subscriptionCharges: GatewaySubscriptionChargeInput[] = [];
  subscriptionChargeUpdates: GatewaySubscriptionChargeUpdateInput[] = [];
  subscriptionValueUpdates: GatewaySubscriptionValueUpdateInput[] = [];
  canceled: string[] = [];
  failNextCheckout = false;
  failNextCardPay = false;
  failNextValueUpdate = false;

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

  async createSubscriptionWithCard(
    input: GatewaySubscriptionWithCardInput,
  ): Promise<GatewaySubscriptionWithCardResult> {
    if (this.failNextCardPay) {
      this.failNextCardPay = false;
      throw new Error("card_payment_failed");
    }
    this.cardSubscriptions.push(input);
    const customerId =
      input.customerId ?? `cus_fake_${randomUUID().slice(0, 8)}`;
    return {
      subscriptionId: `sub_fake_${randomUUID().slice(0, 8)}`,
      customerId,
      creditCardBrand: "VISA",
      creditCardLast4: input.creditCard.number.slice(-4),
      status: "ACTIVE",
    };
  }

  async upgradeSubscriptionWithCard(
    input: GatewaySubscriptionUpgradeInput,
  ): Promise<GatewaySubscriptionWithCardResult> {
    if (this.failNextCardPay) {
      this.failNextCardPay = false;
      throw new Error("card_payment_failed");
    }
    this.subscriptionUpgrades.push(input);
    return {
      subscriptionId: input.subscriptionId,
      customerId: input.customerId,
      creditCardBrand: "VISA",
      creditCardLast4: input.creditCard.number.slice(-4),
      status: "ACTIVE",
    };
  }

  async createSubscriptionCharge(
    input: GatewaySubscriptionChargeInput,
  ): Promise<GatewaySubscriptionChargeResult> {
    this.subscriptionCharges.push(input);
    const customerId =
      input.customerId ?? `cus_fake_${randomUUID().slice(0, 8)}`;
    const paymentId = `pay_fake_${randomUUID().slice(0, 8)}`;
    const pixPayload =
      "00020126580014br.gov.bcb.pix0136fake-pix-copia-e-cola";
    const pixImage =
      input.billingType === "PIX"
        ? (await QRCode.toDataURL(pixPayload)).replace(
            /^data:image\/png;base64,/,
            "",
          )
        : "";
    return {
      subscriptionId: `sub_fake_${randomUUID().slice(0, 8)}`,
      customerId,
      status: "ACTIVE",
      instructions:
        input.billingType === "PIX"
          ? {
              billingType: "PIX",
              paymentId,
              pix: {
                encodedImage: pixImage,
                payload: pixPayload,
                expirationDate: null,
              },
            }
          : {
              billingType: "BOLETO",
              paymentId,
              boleto: {
                bankSlipUrl: "https://sandbox.asaas.com/b/fake",
                invoiceUrl: "https://sandbox.asaas.com/i/fake",
                identificationField: "23793.38128 60000.000003 00000.000400 1 00000000000000",
                barCode: "23791000000000000000000000000000000000000000",
              },
            },
    };
  }

  async updateSubscriptionCharge(
    input: GatewaySubscriptionChargeUpdateInput,
  ): Promise<GatewaySubscriptionChargeResult> {
    this.subscriptionChargeUpdates.push(input);
    return this.createSubscriptionCharge({
      customerId: input.customerId,
      value: input.value,
      cycle: "MONTHLY",
      nextDueDate: new Date().toISOString().slice(0, 10),
      description: input.description,
      externalReference: input.subscriptionId,
      billingType: input.billingType,
    });
  }

  async updateSubscriptionValue(
    input: GatewaySubscriptionValueUpdateInput,
  ): Promise<void> {
    if (this.failNextValueUpdate) {
      this.failNextValueUpdate = false;
      throw new Error("subscription_value_update_failed");
    }
    this.subscriptionValueUpdates.push(input);
  }
}
