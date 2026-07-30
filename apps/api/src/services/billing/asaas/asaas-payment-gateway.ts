import {
  PaymentGatewayError,
  type GatewayCustomer,
  type GatewayCustomerInput,
  type GatewaySubscriptionCheckout,
  type GatewaySubscriptionCheckoutInput,
  type PaymentGateway,
} from "../payment-gateway.js";
import { asaasFetch } from "./asaas-client.js";
import type { AsaasConfig } from "./asaas-config.js";

type AsaasCustomerResponse = { id: string };
type AsaasCheckoutResponse = {
  id: string;
  link?: string;
  url?: string;
  expirationDate?: string;
};

export function createAsaasPaymentGateway(cfg: AsaasConfig): PaymentGateway {
  return {
    async createCustomer(
      input: GatewayCustomerInput,
    ): Promise<GatewayCustomer> {
      const data = await asaasFetch<AsaasCustomerResponse>(cfg, "/customers", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          email: input.email,
          cpfCnpj: input.cpfCnpj,
          mobilePhone: input.mobilePhone || undefined,
          externalReference: input.externalReference,
          notificationDisabled: true,
        }),
      });
      if (!data?.id) {
        throw new PaymentGatewayError(
          "Cliente Asaas sem id",
          "ASAAS_CUSTOMER_INVALID",
        );
      }
      return { id: data.id };
    },

    async createSubscriptionCheckout(
      input: GatewaySubscriptionCheckoutInput,
    ): Promise<GatewaySubscriptionCheckout> {
      const body: Record<string, unknown> = {
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["RECURRENT"],
        minutesToExpire: input.minutesToExpire,
        callback: {
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
          expiredUrl: input.expiredUrl,
        },
        items: input.items.map((it) => ({
          name: it.name,
          description: it.description,
          quantity: it.quantity,
          value: it.value,
        })),
        subscription: {
          cycle: input.cycle,
          nextDueDate: input.nextDueDate,
        },
        externalReference: input.externalReference,
      };

      if (input.customerId) {
        body.customer = input.customerId;
      }
      if (input.customerData) {
        body.customerData = {
          name: input.customerData.name,
          email: input.customerData.email,
          cpfCnpj: input.customerData.cpfCnpj,
          phone: input.customerData.phone || undefined,
        };
      }

      const data = await asaasFetch<AsaasCheckoutResponse>(cfg, "/checkouts", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const link =
        data.link ||
        data.url ||
        `${cfg.checkoutUrlPrefix}/${data.id}` ||
        `${cfg.checkoutUrlPrefix}?id=${data.id}`;

      if (!data?.id || !link) {
        throw new PaymentGatewayError(
          "Checkout Asaas inválido",
          "ASAAS_CHECKOUT_INVALID",
        );
      }

      return {
        id: data.id,
        link,
        expiresAt: data.expirationDate
          ? new Date(data.expirationDate)
          : new Date(Date.now() + input.minutesToExpire * 60_000),
      };
    },

    async cancelSubscription(subscriptionId: string): Promise<void> {
      await asaasFetch(cfg, `/subscriptions/${subscriptionId}`, {
        method: "DELETE",
      });
    },
  };
}
