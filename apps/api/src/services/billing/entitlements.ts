import {
  getPlanDefinition,
  planHasFeature,
  type PlanFeature,
  type PlanId,
  type PlanLimits,
} from "@pedidos/shared";
import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../db.js";
import { ensureOrgSubscription } from "./subscription.js";

export type OrgEntitlements = {
  planId: PlanId;
  status: SubscriptionStatus;
  features: PlanFeature[];
  limits: PlanLimits;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  provider: string;
};

export async function getOrgEntitlements(
  organizationId: string,
): Promise<OrgEntitlements> {
  const sub = await ensureOrgSubscription(organizationId);
  const def = getPlanDefinition(sub.planId);
  return {
    planId: def.id,
    status: sub.status,
    features: def.features,
    limits: def.limits,
    currentPeriodEnd: sub.currentPeriodEnd
      ? sub.currentPeriodEnd.toISOString()
      : null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    provider: sub.provider,
  };
}

export async function orgHasPlanFeature(
  organizationId: string,
  feature: PlanFeature,
): Promise<boolean> {
  const ent = await getOrgEntitlements(organizationId);
  return planHasFeature(ent.planId, feature);
}

export async function countOrgSellers(organizationId: string): Promise<number> {
  return prisma.seller.count({ where: { organizationId } });
}

export async function countOrgUsers(organizationId: string): Promise<number> {
  return prisma.user.count({ where: { organizationId } });
}
