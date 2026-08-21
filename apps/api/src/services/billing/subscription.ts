import {
    DEFAULT_PLAN_ID,
    DEFAULT_TRIAL_DAYS,
    type PlanId,
} from "@pedidos/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../db.js";

type Db = PrismaClient | Prisma.TransactionClient;

export function trialPeriodEnd(
  from = new Date(),
  days = DEFAULT_TRIAL_DAYS,
): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + days);
  return end;
}

/** Garante assinatura 1:1 (Start + TRIAL por padrão). */
export async function ensureOrgSubscription(
  organizationId: string,
  opts?: { planId?: PlanId; tx?: Db },
) {
  const db = opts?.tx ?? prisma;
  const existing = await db.organizationSubscription.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;

  const now = new Date();
  return db.organizationSubscription.create({
    data: {
      organizationId,
      planId: opts?.planId ?? DEFAULT_PLAN_ID,
      status: "TRIAL",
      provider: "none",
      currentPeriodStart: now,
      currentPeriodEnd: trialPeriodEnd(now),
    },
  });
}
