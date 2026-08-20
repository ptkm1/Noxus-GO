import {
    PaymentGatewayError,
    type GatewayCustomer,
    type GatewayCustomerBilling,
    type GatewayCustomerInput,
    type GatewaySubscriptionCheckout,
    type GatewaySubscriptionCheckoutInput,
    type GatewaySubscriptionUpgradeInput,
    type GatewaySubscriptionWithCardInput,
    type GatewaySubscriptionWithCardResult,
    type PaymentGateway,
} from "../payment-gateway.js";
import { asaasFetch } from "./asaas-client.js";
import type { AsaasConfig } from "./asaas-config.js";

type AsaasCustomerResponse = { id: string };
type AsaasCustomerListResponse = { data?: AsaasCustomerResponse[] };
type AsaasCheckoutResponse = {
  id: string;
  link?: string;
  url?: string;
  expirationDate?: string;
};
type AsaasSubscriptionResponse = {
  id: string;
  customer?: string;
  status?: string;
  creditCard?: {
    creditCardNumber?: string;
    creditCardBrand?: string;
    creditCardToken?: string;
  };
};

/** Limite do campo `name` nos itens do checkout Asaas. */
function asaasCheckoutItemName(text: string, max = 30): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

async function findCustomerByCpfCnpj(
  cfg: AsaasConfig,
  cpfCnpj: string,
  externalReference?: string,
): Promise<string | null> {
  const { listAsaasCustomersByCpfCnpj } = await import(
    "./asaas-customer-resolver.js"
  );
  const matches = await listAsaasCustomersByCpfCnpj(cfg, cpfCnpj);
  if (externalReference) {
    const scoped = matches.find(
      (c) => c.externalReference === externalReference && c.id,
    );
    if (scoped?.id) return scoped.id;
    return null;
  }
  return matches[0]?.id ?? null;
}

function formatAsaasPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return digits;
  if (digits.length === 10) return `${digits.slice(0, 2)}9${digits.slice(2)}`;
  return "11987654321";
}

function customerUpdatePayload(
  name: string,
  email: string,
  billing: GatewayCustomerBilling,
): Record<string, unknown> {
  return {
    name,
    email,
    mobilePhone: formatAsaasPhone(billing.phone),
    address: billing.address,
    addressNumber: billing.addressNumber,
    complement: billing.complement || undefined,
    province: billing.province,
    postalCode: billing.postalCode,
  };
}

function checkoutCustomerDataPayload(
  name: string,
  email: string,
  cpfCnpj: string,
  billing: GatewayCustomerBilling,
): Record<string, unknown> {
  const addressNumber = Number.parseInt(
    billing.addressNumber.replace(/\D/g, ""),
    10,
  );
  const cityIbge = billing.cityIbge?.replace(/\D/g, "");
  return {
    name,
    email,
    cpfCnpj,
    phone: formatAsaasPhone(billing.phone),
    address: billing.address,
    addressNumber: Number.isFinite(addressNumber) ? addressNumber : 1,
    complement: billing.complement || undefined,
    province: billing.province,
    postalCode: billing.postalCode,
    ...(cityIbge && cityIbge.length >= 6
      ? { city: Number.parseInt(cityIbge, 10) }
      : {}),
  };
}

async function syncCustomerBilling(
  cfg: AsaasConfig,
  customerId: string,
  name: string,
  email: string,
  billing: GatewayCustomerBilling,
): Promise<void> {
  await asaasFetch(cfg, `/customers/${customerId}`, {
    method: "PUT",
    body: JSON.stringify(customerUpdatePayload(name, email, billing)),
  });
}

export function createAsaasPaymentGateway(cfg: AsaasConfig): PaymentGateway {
  return {
    async createCustomer(
      input: GatewayCustomerInput,
    ): Promise<GatewayCustomer> {
      try {
        const data = await asaasFetch<AsaasCustomerResponse>(
          cfg,
          "/customers",
          {
            method: "POST",
            body: JSON.stringify({
              name: input.name,
              email: input.email,
              cpfCnpj: input.cpfCnpj,
              mobilePhone: input.mobilePhone || undefined,
              externalReference: input.externalReference,
              notificationDisabled: true,
            }),
          },
        );
        if (!data?.id) {
          throw new PaymentGatewayError(
            "Cliente Asaas sem id",
            "ASAAS_CUSTOMER_INVALID",
          );
        }
        return { id: data.id };
      } catch (err) {
        if (
          !(err instanceof PaymentGatewayError) ||
          err.code !== "ASAAS_HTTP_ERROR"
        ) {
          throw err;
        }
        const existingId = await findCustomerByCpfCnpj(
          cfg,
          input.cpfCnpj,
          input.externalReference,
        );
        if (!existingId) throw err;
        try {
          await asaasFetch(cfg, `/customers/${existingId}`, {
            method: "PUT",
            body: JSON.stringify({
              name: input.name,
              email: input.email,
              mobilePhone: input.mobilePhone || undefined,
              externalReference: input.externalReference,
            }),
          });
        } catch {
          /* atualização opcional — o checkout usa o id existente */
        }
        return { id: existingId };
      }
    },

    async createSubscriptionCheckout(
      input: GatewaySubscriptionCheckoutInput,
    ): Promise<GatewaySubscriptionCheckout> {
      const billing = input.customerData?.billing;

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
          name: asaasCheckoutItemName(it.name),
          description: it.description?.slice(0, 150),
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
      } else if (input.customerData && billing) {
        body.customerData = checkoutCustomerDataPayload(
          input.customerData.name,
          input.customerData.email,
          input.customerData.cpfCnpj,
          billing,
        );
      }

      const data = await asaasFetch<AsaasCheckoutResponse>(cfg, "/checkouts", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const link =
        data.link ||
        data.url ||
        (data.id ? `${cfg.checkoutUrlPrefix}?id=${data.id}` : "");

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

    async createSubscriptionWithCard(
      input: GatewaySubscriptionWithCardInput,
    ): Promise<GatewaySubscriptionWithCardResult> {
      let customerId = input.customerId;
      if (!customerId && input.customer) {
        const created = await this.createCustomer(input.customer);
        customerId = created.id;
      }
      if (!customerId) {
        throw new PaymentGatewayError(
          "Cliente Asaas obrigatório",
          "ASAAS_CUSTOMER_REQUIRED",
          400,
        );
      }

      if (input.customer && input.customerBilling) {
        await syncCustomerBilling(
          cfg,
          customerId,
          input.customer.name,
          input.customer.email,
          input.customerBilling,
        );
      }

      const body: Record<string, unknown> = {
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: input.value,
        cycle: input.cycle,
        nextDueDate: input.nextDueDate,
        description: input.description.slice(0, 500),
        externalReference: input.externalReference,
        creditCard: {
          holderName: input.creditCard.holderName,
          number: input.creditCard.number,
          expiryMonth: input.creditCard.expiryMonth,
          expiryYear: input.creditCard.expiryYear,
          ccv: input.creditCard.ccv,
        },
        creditCardHolderInfo: {
          name: input.creditCardHolderInfo.name,
          email: input.creditCardHolderInfo.email,
          cpfCnpj: input.creditCardHolderInfo.cpfCnpj,
          postalCode: input.creditCardHolderInfo.postalCode,
          addressNumber: input.creditCardHolderInfo.addressNumber,
          addressComplement:
            input.creditCardHolderInfo.addressComplement || undefined,
          phone: input.creditCardHolderInfo.phone || undefined,
          mobilePhone: input.creditCardHolderInfo.mobilePhone,
        },
        remoteIp: input.remoteIp,
      };

      const data = await asaasFetch<AsaasSubscriptionResponse>(
        cfg,
        "/subscriptions",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      if (!data?.id) {
        throw new PaymentGatewayError(
          "Assinatura Asaas inválida",
          "ASAAS_SUBSCRIPTION_INVALID",
        );
      }

      return {
        subscriptionId: data.id,
        customerId,
        creditCardToken: data.creditCard?.creditCardToken ?? null,
        creditCardBrand: data.creditCard?.creditCardBrand ?? null,
        creditCardLast4: data.creditCard?.creditCardNumber ?? null,
        status: data.status ?? null,
      };
    },

    async upgradeSubscriptionWithCard(
      input: GatewaySubscriptionUpgradeInput,
    ): Promise<GatewaySubscriptionWithCardResult> {
      await asaasFetch<AsaasSubscriptionResponse>(
        cfg,
        `/subscriptions/${input.subscriptionId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            value: input.value,
            description: input.description.slice(0, 500),
            updatePendingPayments: input.updatePendingPayments,
          }),
        },
      );

      const data = await asaasFetch<AsaasSubscriptionResponse>(
        cfg,
        `/subscriptions/${input.subscriptionId}/creditCard`,
        {
          method: "PUT",
          body: JSON.stringify({
            creditCard: {
              holderName: input.creditCard.holderName,
              number: input.creditCard.number,
              expiryMonth: input.creditCard.expiryMonth,
              expiryYear: input.creditCard.expiryYear,
              ccv: input.creditCard.ccv,
            },
            creditCardHolderInfo: {
              name: input.creditCardHolderInfo.name,
              email: input.creditCardHolderInfo.email,
              cpfCnpj: input.creditCardHolderInfo.cpfCnpj,
              postalCode: input.creditCardHolderInfo.postalCode,
              addressNumber: input.creditCardHolderInfo.addressNumber,
              addressComplement:
                input.creditCardHolderInfo.addressComplement || undefined,
              phone: input.creditCardHolderInfo.phone || undefined,
              mobilePhone: input.creditCardHolderInfo.mobilePhone,
            },
            remoteIp: input.remoteIp,
          }),
        },
      );

      return {
        subscriptionId: input.subscriptionId,
        customerId: input.customerId,
        creditCardToken: data.creditCard?.creditCardToken ?? null,
        creditCardBrand: data.creditCard?.creditCardBrand ?? null,
        creditCardLast4: data.creditCard?.creditCardNumber ?? null,
        status: data.status ?? null,
      };
    },
  };
}
