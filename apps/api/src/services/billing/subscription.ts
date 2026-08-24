import {
    DEFAULT_PLAN_ID,
    DEFAULT_TRIAL_DAYS,
    type PlanId,
} from "@pedidos/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../db.js";

type Db = PrismaClient | Prisma.TransactionClient;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Fim do trial: `days` × 24h após `from`.
 *
 * Cálculo em UTC (timestamptz no banco), independente do fuso do processo.
 * Na UI, exibir `currentPeriodEnd` em America/Sao_Paulo.
 * O trial existe em qualquer ambiente.
 */
export function trialPeriodEnd(
  from = new Date(),
  days = DEFAULT_TRIAL_DAYS,
): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
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
