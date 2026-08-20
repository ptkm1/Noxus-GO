import {
    PaymentGatewayError,
    type GatewayCustomer,
    type GatewayCustomerBilling,
    type GatewayCustomerInput,
    type GatewaySubscriptionCheckout,
    type GatewaySubscriptionCheckoutInput,
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

/** Limite do campo `name` nos itens do checkout Asaas. */
function asaasCheckoutItemName(text: string, max = 30): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

async function findCustomerByCpfCnpj(
  cfg: AsaasConfig,
  cpfCnpj: string,
): Promise<string | null> {
  const q = encodeURIComponent(cpfCnpj);
  const data = await asaasFetch<AsaasCustomerListResponse>(
    cfg,
    `/customers?cpfCnpj=${q}&limit=1`,
    { method: "GET" },
  );
  return data?.data?.[0]?.id ?? null;
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
        const existingId = await findCustomerByCpfCnpj(cfg, input.cpfCnpj);
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
  };
}
