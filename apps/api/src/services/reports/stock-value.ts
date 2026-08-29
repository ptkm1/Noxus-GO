import type { StockValueBasis } from "@pedidos/shared";
import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

type ProductPriceRow = {
  costPrice: unknown | null;
  basePrice: unknown;
};

/** Preço unitário por produto conforme a base selecionada (0 quando indisponível). */
export async function loadStockUnitPrices(params: {
  organizationId: string;
  productIds: string[];
  basis: Exclude<StockValueBasis, "none">;
}): Promise<Map<string, number>> {
  const { organizationId, productIds, basis } = params;
  const result = new Map<string, number>();
  if (!productIds.length) return result;

  if (basis === "avg_sale") {
    const items = await prisma.orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: { organizationId, status: "CONFIRMED" },
      },
      select: { productId: true, quantity: true, unitPrice: true },
    });

    const acc = new Map<string, { qty: number; amount: number }>();
    for (const it of items) {
      const cur = acc.get(it.productId) ?? { qty: 0, amount: 0 };
      cur.qty += it.quantity;
      cur.amount += decToNum(it.unitPrice) * it.quantity;
      acc.set(it.productId, cur);
    }

    for (const [productId, { qty, amount }] of acc) {
      if (qty > 0) result.set(productId, roundMoney(amount / qty));
    }
    return result;
  }

  const rows = await prisma.product.findMany({
    where: { organizationId, id: { in: productIds } },
    select: { id: true, costPrice: true, basePrice: true },
  });

  for (const row of rows) {
    const price = unitPriceFromProductRow(row, basis);
    if (price != null) result.set(row.id, price);
  }
  return result;
}

function unitPriceFromProductRow(
  row: ProductPriceRow,
  basis: Exclude<StockValueBasis, "none">,
): number | null {
  if (basis === "last_cost") {
    return row.costPrice != null ? decToNum(row.costPrice) : null;
  }
  return decToNum(row.basePrice);
}

export function stockLineValue(stockQty: number, unitPrice: number | undefined): number {
  const price = unitPrice ?? 0;
  return roundMoney(stockQty * price);
}
