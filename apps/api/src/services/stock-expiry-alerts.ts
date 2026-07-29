import { prisma } from "../db.js";
import { notifyUsers } from "./notify.js";

/** Limiares em dias até o vencimento (0 = já vencido). */
export const STOCK_EXPIRY_THRESHOLDS = [30, 7, 3, 0] as const;

export type StockExpiryAlertRunResult = {
  organizations: number;
  lotsScanned: number;
  newAlerts: number;
  notifiedOrgs: number;
};

function startOfTodayUtcLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysUntilExpiry(expiresAt: Date, today: Date): number {
  return Math.ceil(
    (expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function crossedThresholds(days: number): number[] {
  return STOCK_EXPIRY_THRESHOLDS.filter((t) => days <= t);
}

/**
 * Para cada org: detecta lotes (qty > 0) que cruzaram limiares 30/7/3/0
 * ainda não registrados em StockExpiryAlert; grava dedupe e envia
 * 1 push resumo para ADMIN + MANAGER.
 */
export async function runStockExpiryAlerts(params?: {
  organizationId?: string;
}): Promise<StockExpiryAlertRunResult> {
  const today = startOfTodayUtcLocal();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + Math.max(...STOCK_EXPIRY_THRESHOLDS));

  const orgs = await prisma.organization.findMany({
    where: params?.organizationId ? { id: params.organizationId } : undefined,
    select: { id: true, name: true, displayName: true },
  });

  let lotsScanned = 0;
  let newAlerts = 0;
  let notifiedOrgs = 0;

  for (const org of orgs) {
    const lots = await prisma.productLot.findMany({
      where: {
        organizationId: org.id,
        qty: { gt: 0 },
        expiresAt: { lte: horizon },
      },
      select: {
        id: true,
        expiresAt: true,
        product: { select: { name: true, sku: true } },
      },
    });
    lotsScanned += lots.length;
    if (!lots.length) continue;

    const existing = await prisma.stockExpiryAlert.findMany({
      where: {
        organizationId: org.id,
        lotId: { in: lots.map((l) => l.id) },
      },
      select: { lotId: true, thresholdDays: true },
    });
    const seen = new Set(existing.map((e) => `${e.lotId}:${e.thresholdDays}`));

    const toInsert: {
      organizationId: string;
      lotId: string;
      thresholdDays: number;
    }[] = [];

    let criticalCount = 0;
    const lotIdsNew = new Set<string>();

    for (const lot of lots) {
      const days = daysUntilExpiry(lot.expiresAt, today);
      const thresholds = crossedThresholds(days);
      let lotHasNew = false;
      for (const t of thresholds) {
        const key = `${lot.id}:${t}`;
        if (seen.has(key)) continue;
        toInsert.push({
          organizationId: org.id,
          lotId: lot.id,
          thresholdDays: t,
        });
        seen.add(key);
        lotHasNew = true;
      }
      if (lotHasNew) {
        lotIdsNew.add(lot.id);
        if (days <= 3) criticalCount += 1;
      }
    }

    if (!toInsert.length) continue;

    await prisma.stockExpiryAlert.createMany({
      data: toInsert,
      skipDuplicates: true,
    });
    newAlerts += toInsert.length;

    const recipients = await prisma.user.findMany({
      where: {
        organizationId: org.id,
        role: { in: ["ADMIN", "MANAGER"] },
      },
      select: { id: true },
    });
    if (!recipients.length) continue;

    const count = lotIdsNew.size;
    const title = "Validade de estoque";
    const body =
      criticalCount > 0
        ? `${count} lote(s) cruzaram limiar de validade (${criticalCount} crítico(s) ≤3 dias).`
        : `${count} lote(s) cruzaram limiar de validade.`;

    await notifyUsers({
      userIds: recipients.map((u) => u.id),
      title,
      body,
      type: "STOCK_EXPIRY",
      data: {
        href: "/estoque",
        count,
        criticalCount,
      },
    });
    notifiedOrgs += 1;
  }

  return {
    organizations: orgs.length,
    lotsScanned,
    newAlerts,
    notifiedOrgs,
  };
}
