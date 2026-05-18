import type { ProductCombo, ProductComboDiscountKind, ProductComboLine } from "@prisma/client";
import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function comboActiveAt(c: Pick<ProductCombo, "validFrom" | "validTo">, at: Date): boolean {
  if (c.validFrom && at < c.validFrom) return false;
  if (c.validTo && at > c.validTo) return false;
  return true;
}

function discountForInstances(
  kind: ProductComboDiscountKind,
  valueNum: number,
  subtotalOneSet: number,
  instances: number,
): number {
  if (instances <= 0) return 0;
  if (kind === "FIXED_PER_COMPLETE_SET") return roundMoney(instances * valueNum);
  return roundMoney(instances * subtotalOneSet * (valueNum / 100));
}

type ComboLoaded = ProductCombo & { lines: ProductComboLine[] };

/**
 * Greedy por prioridade: em cada passo aplica o primeiro combo da lista que ainda fecha conjuntos completos,
 * debitando quantidades do mapa até não haver mais correspondências.
 */
export async function computeGreedyComboDiscount(
  organizationId: string,
  cart: Map<string, { qty: number; unitPrice: number }>,
  at: Date,
): Promise<number> {
  const combos = (await prisma.productCombo.findMany({
    where: { organizationId, active: true },
    include: { lines: true },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  })) as ComboLoaded[];

  const remaining = new Map<string, number>();
  for (const [pid, v] of cart) remaining.set(pid, v.qty);

  let totalDiscount = 0;

  let progress = true;
  while (progress) {
    progress = false;
    for (const combo of combos) {
      if (!combo.lines.length || !comboActiveAt(combo, at)) continue;

      let instances = Number.POSITIVE_INFINITY;
      for (const line of combo.lines) {
        const have = remaining.get(line.productId) ?? 0;
        instances = Math.min(instances, Math.floor(have / line.quantity));
      }
      if (!Number.isFinite(instances) || instances <= 0) continue;

      let subtotalOneSet = 0;
      for (const line of combo.lines) {
        const unit = cart.get(line.productId)?.unitPrice ?? 0;
        subtotalOneSet += line.quantity * unit;
      }

      totalDiscount += discountForInstances(combo.kind, decToNum(combo.value), subtotalOneSet, instances);

      for (const line of combo.lines) {
        const prev = remaining.get(line.productId) ?? 0;
        remaining.set(line.productId, prev - instances * line.quantity);
      }

      progress = true;
      break;
    }
  }

  return roundMoney(totalDiscount);
}
