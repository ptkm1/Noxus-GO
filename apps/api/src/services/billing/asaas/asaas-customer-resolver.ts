import { normalizeDocument } from "../document.js";
import { PaymentGatewayError } from "../payment-gateway.js";
import { asaasFetch } from "./asaas-client.js";
import type { AsaasConfig } from "./asaas-config.js";

type AsaasCustomer = {
  id?: string;
  cpfCnpj?: string;
  email?: string;
  externalReference?: string | null;
  name?: string;
};

type AsaasCustomerList = { data?: AsaasCustomer[] };

type AsaasSubscription = {
  id?: string;
  customer?: string;
  value?: number;
  externalReference?: string | null;
  status?: string;
};

type AsaasSubscriptionList = { data?: AsaasSubscription[] };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function listAsaasCustomersByCpfCnpj(
  cfg: AsaasConfig,
  cpfCnpj: string,
): Promise<AsaasCustomer[]> {
  const q = encodeURIComponent(normalizeDocument(cpfCnpj));
  const data = await asaasFetch<AsaasCustomerList>(
    cfg,
    `/customers?cpfCnpj=${q}&limit=20`,
    { method: "GET" },
  );
  return data?.data ?? [];
}

/** Cliente Asaas que pertence exclusivamente à organização (CNPJ + e-mail). */
export async function resolveAsaasCustomerForOrg(
  cfg: AsaasConfig,
  params: {
    organizationId: string;
    cpfCnpj: string;
    email: string;
    storedCustomerId?: string | null;
  },
): Promise<string> {
  const doc = normalizeDocument(params.cpfCnpj);
  const email = normalizeEmail(params.email);

  if (params.storedCustomerId) {
    try {
      const remote = await asaasFetch<AsaasCustomer>(
        cfg,
        `/customers/${params.storedCustomerId}`,
        { method: "GET" },
      );
      if (
        remote?.id &&
        normalizeDocument(remote.cpfCnpj ?? "") === doc &&
        normalizeEmail(remote.email ?? "") === email
      ) {
        return remote.id;
      }
    } catch {
      /* id armazenado inválido ou de outra conta — re-resolve abaixo */
    }
  }

  const matches = await listAsaasCustomersByCpfCnpj(cfg, doc);
  const forOrgRef = matches.filter(
    (c) => c.externalReference === params.organizationId,
  );
  if (forOrgRef.length === 1 && forOrgRef[0]?.id) {
    return forOrgRef[0].id;
  }
  if (forOrgRef.length > 1) {
    throw new PaymentGatewayError(
      "Vários clientes Asaas vinculados à mesma organização",
      "ASAAS_CUSTOMER_AMBIGUOUS",
      409,
    );
  }

  const byEmail = matches.filter(
    (c) => c.id && normalizeEmail(c.email ?? "") === email,
  );
  if (byEmail.length === 1 && byEmail[0]?.id) {
    return byEmail[0].id;
  }
  if (byEmail.length > 1) {
    for (const candidate of byEmail) {
      if (!candidate.id) continue;
      const subs = await asaasFetch<AsaasSubscriptionList>(
        cfg,
        `/subscriptions?customer=${candidate.id}&status=ACTIVE&limit=1`,
        { method: "GET" },
      );
      if (subs?.data?.[0]?.id) {
        return candidate.id;
      }
    }
    throw new PaymentGatewayError(
      "Vários clientes Asaas com o mesmo e-mail; não foi possível identificar o correto",
      "ASAAS_CUSTOMER_AMBIGUOUS",
      409,
    );
  }

  throw new PaymentGatewayError(
    "Cliente Asaas não encontrado para esta organização",
    "ASAAS_CUSTOMER_NOT_FOUND",
    404,
  );
}

export async function assertAsaasSubscriptionBelongsToCustomer(
  cfg: AsaasConfig,
  subscriptionId: string,
  customerId: string,
): Promise<AsaasSubscription> {
  const sub = await asaasFetch<AsaasSubscription>(
    cfg,
    `/subscriptions/${subscriptionId}`,
    { method: "GET" },
  );
  if (!sub?.id || sub.customer !== customerId) {
    throw new PaymentGatewayError(
      "Assinatura Asaas não pertence a este cliente/organização",
      "ASAAS_SUBSCRIPTION_MISMATCH",
      409,
    );
  }
  return sub;
}

/** Recupera ids Asaas quando só temos CNPJ/e-mail da org (ex.: checkout hospedado antigo). */
export async function discoverAsaasProviderIdsForOrg(
  cfg: AsaasConfig,
  params: {
    organizationId: string;
    cpfCnpj: string;
    email: string;
  },
): Promise<{ customerId: string; subscriptionId: string | null } | null> {
  let customerId: string;
  try {
    customerId = await resolveAsaasCustomerForOrg(cfg, {
      organizationId: params.organizationId,
      cpfCnpj: params.cpfCnpj,
      email: params.email,
    });
  } catch (err) {
    if (
      err instanceof PaymentGatewayError &&
      err.code === "ASAAS_CUSTOMER_NOT_FOUND"
    ) {
      return null;
    }
    throw err;
  }

  const subs = await asaasFetch<AsaasSubscriptionList>(
    cfg,
    `/subscriptions?customer=${customerId}&status=ACTIVE&limit=5`,
    { method: "GET" },
  );
  const active =
    subs?.data?.find((s) => s.id && s.status !== "INACTIVE") ?? subs?.data?.[0];
  return {
    customerId,
    subscriptionId: active?.id ?? null,
  };
}
