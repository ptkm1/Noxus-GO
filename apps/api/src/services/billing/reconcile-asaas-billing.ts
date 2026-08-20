import {
    getPlanDefinition,
    planIdFromMonthlyPrice,
    type PlanId,
} from "@pedidos/shared";
import { prisma } from "../../db.js";
import { asaasFetch } from "./asaas/asaas-client.js";
import { readAsaasConfig } from "./asaas/asaas-config.js";
import {
    assertAsaasSubscriptionBelongsToCustomer,
    discoverAsaasProviderIdsForOrg,
    listAsaasCustomersByCpfCnpj,
    resolveAsaasCustomerForOrg,
} from "./asaas/asaas-customer-resolver.js";
import { isFakePaymentGatewayEnabled } from "./resolve-payment-gateway.js";
import { syncPlanFromAsaasProvider } from "./sync-asaas-subscription.js";

type AsaasCustomer = {
  id?: string;
  name?: string;
  externalReference?: string | null;
  email?: string;
};

type AsaasSubscriptionList = {
  data?: Array<{ id?: string; status?: string; value?: number }>;
};

export type BillingDuplicateCustomer = {
  id: string;
  name: string | null;
  externalReference: string | null;
  hasActiveSubscription: boolean;
  isCanonical: boolean;
};

export type BillingReconcileReport = {
  organizationId: string;
  organizationName: string;
  dryRun: boolean;
  provider: string;
  before: {
    planId: PlanId;
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
  };
  after: {
    planId: PlanId;
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
  };
  asaas: {
    customerId: string | null;
    customerName: string | null;
    subscriptionId: string | null;
    subscriptionValue: number | null;
    subscriptionPlanId: PlanId | null;
    subscriptionStatus: string | null;
  };
  duplicateCustomers: BillingDuplicateCustomer[];
  issues: string[];
  fixed: string[];
};

async function listDuplicateCustomers(
  cfg: NonNullable<ReturnType<typeof readAsaasConfig>>,
  cpfCnpj: string,
  canonicalCustomerId: string | null,
): Promise<BillingDuplicateCustomer[]> {
  const matches = await listAsaasCustomersByCpfCnpj(cfg, cpfCnpj);
  if (matches.length <= 1) return [];

  const out: BillingDuplicateCustomer[] = [];
  for (const c of matches) {
    if (!c.id) continue;
    let hasActiveSubscription = false;
    try {
      const subs = await asaasFetch<AsaasSubscriptionList>(
        cfg,
        `/subscriptions?customer=${c.id}&status=ACTIVE&limit=1`,
        { method: "GET" },
      );
      hasActiveSubscription = Boolean(subs?.data?.[0]?.id);
    } catch {
      /* ignore */
    }
    out.push({
      id: c.id,
      name: c.name ?? null,
      externalReference: c.externalReference ?? null,
      hasActiveSubscription,
      isCanonical: c.id === canonicalCustomerId,
    });
  }
  return out;
}

export async function reconcileOrganizationBilling(
  organizationId: string,
  opts?: { dryRun?: boolean },
): Promise<BillingReconcileReport> {
  const dryRun = opts?.dryRun ?? false;
  const issues: string[] = [];
  const fixed: string[] = [];

  if (isFakePaymentGatewayEnabled()) {
    throw Object.assign(
      new Error("Reconciliação disponível apenas com gateway Asaas"),
      { code: "FAKE_GATEWAY", http: 400 },
    );
  }

  const cfg = readAsaasConfig();
  if (!cfg) {
    throw Object.assign(new Error("Asaas não configurado"), {
      code: "ASAAS_NOT_CONFIGURED",
      http: 503,
    });
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      displayName: true,
      document: true,
      cnpj: true,
      subscription: true,
      users: {
        where: { role: "ADMIN" },
        take: 1,
        select: { email: true },
      },
    },
  });

  if (!org?.subscription) {
    throw Object.assign(new Error("Organização ou assinatura não encontrada"), {
      code: "NOT_FOUND",
      http: 404,
    });
  }

  const doc = org.document || org.cnpj;
  const adminEmail = org.users[0]?.email;
  if (!doc || !adminEmail) {
    throw Object.assign(
      new Error("CNPJ e administrador são obrigatórios para reconciliar"),
      { code: "INCOMPLETE_ORG", http: 400 },
    );
  }

  const sub = org.subscription;
  const before = {
    planId: sub.planId as PlanId,
    providerCustomerId: sub.providerCustomerId,
    providerSubscriptionId: sub.providerSubscriptionId,
  };

  let canonicalCustomerId: string | null = before.providerCustomerId;
  try {
    canonicalCustomerId = await resolveAsaasCustomerForOrg(cfg, {
      organizationId,
      cpfCnpj: doc,
      email: adminEmail,
      storedCustomerId: before.providerCustomerId,
    });
  } catch {
    const discovered = await discoverAsaasProviderIdsForOrg(cfg, {
      organizationId,
      cpfCnpj: doc,
      email: adminEmail,
    });
    canonicalCustomerId = discovered?.customerId ?? null;
    if (!canonicalCustomerId) {
      issues.push("Nenhum cliente Asaas encontrado para esta organização");
    }
  }

  let canonicalSubscriptionId = before.providerSubscriptionId;
  if (canonicalCustomerId) {
    const discovered = await discoverAsaasProviderIdsForOrg(cfg, {
      organizationId,
      cpfCnpj: doc,
      email: adminEmail,
    });
    if (discovered?.subscriptionId) {
      canonicalSubscriptionId = discovered.subscriptionId;
    }

    if (
      before.providerCustomerId &&
      before.providerCustomerId !== canonicalCustomerId
    ) {
      issues.push(
        `providerCustomerId local (${before.providerCustomerId}) difere do Asaas (${canonicalCustomerId})`,
      );
    }
    if (
      before.providerSubscriptionId &&
      canonicalSubscriptionId &&
      before.providerSubscriptionId !== canonicalSubscriptionId
    ) {
      issues.push(
        `providerSubscriptionId local (${before.providerSubscriptionId}) difere do Asaas (${canonicalSubscriptionId})`,
      );
    }

    if (canonicalSubscriptionId) {
      try {
        await assertAsaasSubscriptionBelongsToCustomer(
          cfg,
          canonicalSubscriptionId,
          canonicalCustomerId,
        );
      } catch {
        issues.push(
          "Assinatura armazenada não pertence ao cliente canônico no Asaas",
        );
        canonicalSubscriptionId = null;
      }
    }

    let customerName: string | null = null;
    try {
      const remote = await asaasFetch<AsaasCustomer>(
        cfg,
        `/customers/${canonicalCustomerId}`,
        { method: "GET" },
      );
      customerName = remote.name ?? null;
      if (remote.externalReference !== organizationId) {
        issues.push(
          remote.externalReference
            ? `externalReference do cliente Asaas aponta para outro id (${remote.externalReference})`
            : "Cliente Asaas sem externalReference vinculado à organização",
        );
        if (!dryRun) {
          await asaasFetch(cfg, `/customers/${canonicalCustomerId}`, {
            method: "PUT",
            body: JSON.stringify({ externalReference: organizationId }),
          });
          fixed.push(
            `externalReference do cliente ${canonicalCustomerId} atualizado para a organização`,
          );
        }
      }
    } catch {
      issues.push("Não foi possível consultar cliente canônico no Asaas");
    }

    const duplicateCustomers = await listDuplicateCustomers(
      cfg,
      doc,
      canonicalCustomerId,
    );
    if (duplicateCustomers.length > 0) {
      issues.push(
        `${duplicateCustomers.length} clientes duplicados com o mesmo CNPJ no Asaas (remova manualmente no sandbox os que não têm assinatura)`,
      );
    }

    const updateData: {
      providerCustomerId?: string;
      providerSubscriptionId?: string;
      provider?: string;
    } = {};
    if (
      canonicalCustomerId &&
      canonicalCustomerId !== before.providerCustomerId
    ) {
      updateData.providerCustomerId = canonicalCustomerId;
      if (!dryRun) {
        fixed.push(`providerCustomerId atualizado para ${canonicalCustomerId}`);
      }
    }
    if (
      canonicalSubscriptionId &&
      canonicalSubscriptionId !== before.providerSubscriptionId
    ) {
      updateData.providerSubscriptionId = canonicalSubscriptionId;
      if (!dryRun) {
        fixed.push(
          `providerSubscriptionId atualizado para ${canonicalSubscriptionId}`,
        );
      }
    }
    if (sub.provider !== "asaas") {
      updateData.provider = "asaas";
      if (!dryRun) fixed.push("provider definido como asaas");
    }

    if (!dryRun && Object.keys(updateData).length > 0) {
      await prisma.organizationSubscription.update({
        where: { organizationId },
        data: updateData,
      });
    }

    let subscriptionValue: number | null = null;
    let subscriptionStatus: string | null = null;
    let subscriptionPlanId: PlanId | null = null;
    if (canonicalSubscriptionId) {
      try {
        const remoteSub = await asaasFetch<{
          value?: number;
          status?: string;
        }>(cfg, `/subscriptions/${canonicalSubscriptionId}`, {
          method: "GET",
        });
        subscriptionValue =
          typeof remoteSub.value === "number"
            ? Math.round(remoteSub.value * 100) / 100
            : null;
        subscriptionStatus = remoteSub.status ?? null;
        subscriptionPlanId = subscriptionValue
          ? planIdFromMonthlyPrice(subscriptionValue)
          : null;
      } catch {
        issues.push("Não foi possível consultar assinatura no Asaas");
      }
    }

    let afterPlanId = before.planId;
    if (!dryRun) {
      const synced = await syncPlanFromAsaasProvider(organizationId, {
        force: true,
      });
      if (synced && synced !== before.planId) {
        fixed.push(
          `planId alinhado com Asaas (${getPlanDefinition(before.planId).name} → ${getPlanDefinition(synced).name})`,
        );
      }
      afterPlanId = synced ?? before.planId;
    } else if (subscriptionPlanId && subscriptionPlanId !== before.planId) {
      issues.push(
        `planId local (${getPlanDefinition(before.planId).name}) difere do valor no Asaas (${getPlanDefinition(subscriptionPlanId).name})`,
      );
      afterPlanId = subscriptionPlanId;
    }

    const refreshed = dryRun
      ? sub
      : await prisma.organizationSubscription.findUnique({
          where: { organizationId },
        });

    return {
      organizationId,
      organizationName: org.displayName || org.name,
      dryRun,
      provider: refreshed?.provider ?? sub.provider,
      before,
      after: {
        planId: (dryRun ? afterPlanId : refreshed?.planId ?? afterPlanId) as PlanId,
        providerCustomerId: dryRun
          ? canonicalCustomerId ?? before.providerCustomerId
          : refreshed?.providerCustomerId ?? null,
        providerSubscriptionId: dryRun
          ? canonicalSubscriptionId ?? before.providerSubscriptionId
          : refreshed?.providerSubscriptionId ?? null,
      },
      asaas: {
        customerId: canonicalCustomerId,
        customerName,
        subscriptionId: canonicalSubscriptionId,
        subscriptionValue,
        subscriptionPlanId,
        subscriptionStatus,
      },
      duplicateCustomers: await listDuplicateCustomers(
        cfg,
        doc,
        canonicalCustomerId,
      ),
      issues,
      fixed,
    };
  }

  const duplicateCustomers = await listDuplicateCustomers(
    cfg,
    doc,
    canonicalCustomerId,
  );

  return {
    organizationId,
    organizationName: org.displayName || org.name,
    dryRun,
    provider: sub.provider,
    before,
    after: before,
    asaas: {
      customerId: canonicalCustomerId,
      customerName: null,
      subscriptionId: null,
      subscriptionValue: null,
      subscriptionPlanId: null,
      subscriptionStatus: null,
    },
    duplicateCustomers,
    issues,
    fixed,
  };
}
