import { planMonthlyTotal, type PlanId } from "@pedidos/shared";
import { prisma } from "../../db.js";
import { readAsaasConfig } from "./asaas/asaas-config.js";
import { discoverAsaasProviderIdsForOrg } from "./asaas/asaas-customer-resolver.js";
import { countBillableSeats } from "./seats.js";

const lastSyncByOrg = new Map<string, number>();
const SYNC_TTL_MS = 60_000;

/**
 * Garante IDs Asaas locais. Não altera planId: o valor remoto varia com
 * vendedores/admins extras e não identifica o plano.
 */
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
  if (!["ACTIVE", "TRIAL", "PAST_DUE"].includes(sub.status)) {
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

  return sub.planId as PlanId;
}

export async function expectedSubscriptionValueBrl(
  organizationId: string,
  planId: string,
): Promise<number> {
  const { sellerCount, adminCount } = await countBillableSeats(organizationId);
  return planMonthlyTotal(planId, sellerCount, adminCount);
}
