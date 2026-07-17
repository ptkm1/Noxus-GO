import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";

export type SalesBySupplierSummary = {
  generatedAt: string;
  period: { from: string; to: string };
  totals: { totalAmount: number; orderCount: number };
  topSuppliers: Array<{
    supplierId: string | null;
    tradeName: string;
    totalAmount: number;
    orderCount: number;
  }>;
};

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

function parseOptionalDate(raw: string | undefined): Date | null {
  const s = raw?.trim();
  if (!s) return null;
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function buildSalesBySupplier(params: {
  organizationId: string;
  sellerIds?: string[];
  from?: string;
  to?: string;
  limit?: number;
}): Promise<SalesBySupplierSummary> {
  const limit = params.limit ?? 5;
  const fromDt = parseOptionalDate(params.from) ?? startOfCurrentMonthUtc();
  const toDt = parseOptionalDate(params.to) ?? new Date();

  const orderWhere: Prisma.OrderWhereInput = {
    organizationId: params.organizationId,
    status: "CONFIRMED",
    createdAt: { gte: fromDt, lte: toDt },
  };
  if (params.sellerIds && params.sellerIds.length > 0) {
    orderWhere.sellerId = { in: params.sellerIds };
  } else if (params.sellerIds && params.sellerIds.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      period: { from: fromDt.toISOString(), to: toDt.toISOString() },
      totals: { totalAmount: 0, orderCount: 0 },
      topSuppliers: [],
    };
  }

  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: {
      id: true,
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          product: {
            select: {
              supplierId: true,
              supplier: { select: { id: true, tradeName: true } },
            },
          },
        },
      },
    },
  });

  type Agg = {
    supplierId: string | null;
    tradeName: string;
    totalAmount: number;
    orderIds: Set<string>;
  };

  const map = new Map<string, Agg>();
  let totalAmount = 0;

  for (const order of orders) {
    for (const item of order.items) {
      const line = decToNum(item.unitPrice) * item.quantity;
      totalAmount += line;
      const supplierId = item.product.supplierId ?? null;
      const tradeName = item.product.supplier?.tradeName ?? "Sem fornecedor";
      const key = supplierId ?? "__none__";
      const row = map.get(key) ?? {
        supplierId,
        tradeName,
        totalAmount: 0,
        orderIds: new Set<string>(),
      };
      row.totalAmount += line;
      row.orderIds.add(order.id);
      map.set(key, row);
    }
  }

  const named = [...map.values()]
    .filter((r) => r.supplierId != null)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const unnamed = map.get("__none__");
  const ranked =
    named.length >= limit
      ? named.slice(0, limit)
      : [...named, ...(unnamed && named.length < limit ? [unnamed] : [])].slice(
          0,
          limit,
        );

  return {
    generatedAt: new Date().toISOString(),
    period: { from: fromDt.toISOString(), to: toDt.toISOString() },
    totals: { totalAmount, orderCount: orders.length },
    topSuppliers: ranked.map((r) => ({
      supplierId: r.supplierId,
      tradeName: r.tradeName,
      totalAmount: r.totalAmount,
      orderCount: r.orderIds.size,
    })),
  };
}
