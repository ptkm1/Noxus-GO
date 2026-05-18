import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";

export type CommissionResolveContext = {
  /** Faturamento confirmado no mês antes do pedido atual (para faixa progressiva). */
  mtdConfirmedRevenue: number;
};

async function loadApplicableProgressiveTiers(organizationId: string, sellerId: string) {
  const specific = await prisma.commissionProgressiveTier.findMany({
    where: { organizationId, sellerId, active: true },
    orderBy: [{ thresholdAmount: "asc" }, { priority: "desc" }],
  });
  if (specific.length) return specific;
  return prisma.commissionProgressiveTier.findMany({
    where: { organizationId, sellerId: null, active: true },
    orderBy: [{ thresholdAmount: "asc" }, { priority: "desc" }],
  });
}

/** Percentual da faixa progressiva aplicável ao MTD (sem regras por SKU/categoria). */
export async function resolveProgressiveCommissionPercent(
  organizationId: string,
  sellerId: string,
  mtdRevenue: number,
): Promise<number | null> {
  const list = await loadApplicableProgressiveTiers(organizationId, sellerId);
  if (!list.length) return null;
  let picked: (typeof list)[number] | null = null;
  for (const t of list) {
    if (mtdRevenue + 1e-6 >= decToNum(t.thresholdAmount)) picked = t;
  }
  return picked ? decToNum(picked.commissionPercent) : null;
}

/** Linha base exibida ao vendedor: regra geral > progressiva MTD > % cadastro. */
export async function resolveCommissionBaselinePercent(
  organizationId: string,
  sellerId: string,
  mtdRevenue: number,
): Promise<number> {
  const rules = await prisma.sellerCommissionRule.findMany({
    where: { organizationId, sellerId, active: true, productId: null, categoryId: null },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  if (rules.length) return decToNum(rules[0].commissionPercent);

  const prog = await resolveProgressiveCommissionPercent(organizationId, sellerId, mtdRevenue);
  if (prog != null) return prog;

  const seller = await prisma.seller.findFirst({
    where: { id: sellerId, organizationId },
    select: { commissionPercent: true },
  });
  if (!seller) throw new Error("Vendedor não encontrado");
  return decToNum(seller.commissionPercent);
}

/**
 * Comissão efetiva por linha:
 * regra por produto > por categoria > regra geral > faixa progressiva (MTD) > % cadastro do vendedor.
 */
export async function resolveCommissionPercent(
  organizationId: string,
  sellerId: string,
  productId: string,
  categoryId: string | null,
  ctx?: CommissionResolveContext,
): Promise<number> {
  const rules = await prisma.sellerCommissionRule.findMany({
    where: { organizationId, sellerId, active: true },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  for (const r of rules) {
    if (r.productId && r.productId === productId) return decToNum(r.commissionPercent);
  }
  for (const r of rules) {
    if (!r.productId && r.categoryId && categoryId && r.categoryId === categoryId) {
      return decToNum(r.commissionPercent);
    }
  }
  for (const r of rules) {
    if (!r.productId && !r.categoryId) return decToNum(r.commissionPercent);
  }

  if (ctx && ctx.mtdConfirmedRevenue >= 0) {
    const prog = await resolveProgressiveCommissionPercent(
      organizationId,
      sellerId,
      ctx.mtdConfirmedRevenue,
    );
    if (prog != null) return prog;
  }

  const seller = await prisma.seller.findFirst({
    where: { id: sellerId, organizationId },
    select: { commissionPercent: true },
  });
  if (!seller) throw new Error("Vendedor não encontrado");
  return decToNum(seller.commissionPercent);
}

export async function getProgressiveTierRowsForSeller(
  organizationId: string,
  sellerId: string,
): Promise<
  Array<{
    id: string;
    thresholdAmount: number;
    commissionPercent: number;
    label: string | null;
    priority: number;
    scope: "SELLER" | "ORG";
  }>
> {
  const specific = await prisma.commissionProgressiveTier.findMany({
    where: { organizationId, sellerId, active: true },
    orderBy: [{ thresholdAmount: "asc" }, { priority: "desc" }],
  });
  const list =
    specific.length > 0
      ? specific
      : await prisma.commissionProgressiveTier.findMany({
          where: { organizationId, sellerId: null, active: true },
          orderBy: [{ thresholdAmount: "asc" }, { priority: "desc" }],
        });
  return list.map((t) => ({
    id: t.id,
    thresholdAmount: decToNum(t.thresholdAmount),
    commissionPercent: decToNum(t.commissionPercent),
    label: t.label,
    priority: t.priority,
    scope: t.sellerId ? ("SELLER" as const) : ("ORG" as const),
  }));
}
