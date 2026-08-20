import { planIdFromMonthlyPrice, type PlanId } from "@pedidos/shared";
import { prisma } from "../../db.js";
import { asaasFetch } from "./asaas/asaas-client.js";
import { readAsaasConfig } from "./asaas/asaas-config.js";
import { discoverAsaasProviderIdsForOrg } from "./asaas/asaas-customer-resolver.js";

type AsaasSubscriptionResponse = {
  id?: string;
  customer?: string;
  value?: number;
  status?: string;
  description?: string;
};

const lastSyncByOrg = new Map<string, number>();
const SYNC_TTL_MS = 60_000;

/** Alinha planId local com o valor da assinatura no Asaas (fonte da verdade de billing). */
export async function syncPlanFromAsaasProvider(
  organizationId: string,
  opts?: { force?: boolean },
): Promise<PlanId | null> {
  const force = opts?.force ?? false;
  const now = Date.now();
  if (!force && now - (lastSyncByOrg.get(organizationId) ?? 0) < SYNC_TTL_MS) {
    return null;
  }
  lastSyncByOrg.set(organizationId, now);

  const cfg = readAsaasConfig();
  if (!cfg) return null;

  const sub = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    select: {
      planId: true,
      provider: true,
      providerSubscriptionId: true,
      providerCustomerId: true,
      status: true,
    },
  });
  if (!sub || sub.provider !== "asaas") {
    return null;
  }
  if (
    !["ACTIVE", "TRIAL", "PAST_DUE"].includes(sub.status)
  ) {
    return null;
  }

  let providerSubscriptionId = sub.providerSubscriptionId;
  let providerCustomerId = sub.providerCustomerId;

  if (!providerSubscriptionId || !providerCustomerId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        document: true,
        cnpj: true,
        users: {
          where: { role: "ADMIN" },
          take: 1,
          select: { email: true },
        },
      },
    });
    const doc = org?.document || org?.cnpj;
    const email = org?.users[0]?.email;
    if (doc && email) {
      const discovered = await discoverAsaasProviderIdsForOrg(cfg, {
        organizationId,
        cpfCnpj: doc,
        email,
      });
      if (discovered) {
        providerCustomerId = providerCustomerId ?? discovered.customerId;
        providerSubscriptionId =
          providerSubscriptionId ?? discovered.subscriptionId;
        if (providerCustomerId || providerSubscriptionId) {
          await prisma.organizationSubscription.update({
            where: { organizationId },
            data: {
              providerCustomerId: providerCustomerId ?? undefined,
              providerSubscriptionId: providerSubscriptionId ?? undefined,
            },
          });
        }
      }
    }
  }

  if (!providerSubscriptionId) {
    return null;
  }

  try {
    const data = await asaasFetch<AsaasSubscriptionResponse>(
      cfg,
      `/subscriptions/${providerSubscriptionId}`,
      { method: "GET" },
    );
    const remoteValue =
      typeof data.value === "number" ? Math.round(data.value * 100) / 100 : null;
    if (remoteValue == null) return null;

    const remotePlanId = planIdFromMonthlyPrice(remoteValue);
    if (!remotePlanId || remotePlanId === sub.planId) return remotePlanId;

    await prisma.organizationSubscription.update({
      where: { organizationId },
      data: { planId: remotePlanId },
    });

    return remotePlanId;
  } catch {
    return null;
  }
}
