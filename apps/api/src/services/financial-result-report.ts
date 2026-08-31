import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";
import { orderCode } from "./reports/pdf-common.js";
import { calendarMonthBounds } from "./seller-metrics.js";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseOptionalDate(raw: string | undefined): Date | null {
  const s = raw?.trim();
  if (!s) return null;
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function resolvePeriod(from?: string, to?: string): { start: Date; end: Date } {
  const fromDt = parseOptionalDate(from);
  const toDt = parseOptionalDate(to);
  if (fromDt && toDt) return { start: fromDt, end: toDt };
  if (fromDt && !toDt) return { start: fromDt, end: new Date() };
  if (!fromDt && toDt) {
    const start = new Date(toDt);
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end: toDt };
  }
  const m = calendarMonthBounds(new Date());
  return { start: m.start, end: m.end };
}

/** Meses civis com interseção ao intervalo [start, end]. */
function countCalendarMonths(start: Date, end: Date): number {
  const sy = start.getFullYear();
  const sm = start.getMonth();
  const ey = end.getFullYear();
  const em = end.getMonth();
  return (ey - sy) * 12 + (em - sm) + 1;
}

function marginPct(profit: number, revenue: number): number {
  return revenue > 0 ? roundMoney((profit / revenue) * 100) : 0;
}

export function buildCriteriaFooter(includeFixedCosts: boolean): string {
  const base =
    "Lucro por item: valor de venda − custo do produto (costPrice) − comissão da linha. " +
    "Não entram impostos, fretes, taxas bancárias/cartão nem outras despesas operacionais. " +
    "Considera apenas pedidos confirmados no período.";
  if (!includeFixedCosts) {
    return `${base} Custos fixos cadastrados não foram descontados.`;
  }
  return (
    `${base} Custos fixos: soma das despesas fixas ativas, multiplicada pela quantidade de meses civis ` +
    "cobertos pelo período selecionado."
  );
}

type LineAcc = {
  revenue: number;
  productCost: number;
  commission: number;
  quantity: number;
  label: string;
  orderIds: Set<string>;
};

function mapGroupedRows(m: Map<string, LineAcc>) {
  return [...m.entries()]
    .map(([id, r]) => {
      const profit = roundMoney(r.revenue - r.productCost - r.commission);
      return {
        id,
        label: r.label,
        orderCount: r.orderIds.size,
        quantity: r.quantity,
        revenue: roundMoney(r.revenue),
        productCost: roundMoney(r.productCost),
        commission: roundMoney(r.commission),
        profit,
        marginPct: marginPct(profit, r.revenue),
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

async function sumFixedExpensesForPeriod(
  organizationId: string,
  start: Date,
  end: Date,
): Promise<{ total: number; monthlyBase: number; months: number }> {
  const expenses = await prisma.operationalFixedExpense.findMany({
    where: { organizationId, active: true },
    select: { amount: true },
  });
  const monthlyBase = roundMoney(
    expenses.reduce((s, e) => s + decToNum(e.amount), 0),
  );
  const months = countCalendarMonths(start, end);
  return { total: roundMoney(monthlyBase * months), monthlyBase, months };
}

export async function buildFinancialResultReport(params: {
  organizationId: string;
  from?: string;
  to?: string;
  sellerId?: string;
  sellerIds?: string[];
  includeFixedCosts?: boolean;
}) {
  const { start, end } = resolvePeriod(params.from, params.to);
  const where: Prisma.OrderWhereInput = {
    organizationId: params.organizationId,
    status: "CONFIRMED",
    createdAt: { gte: start, lte: end },
  };
  if (params.sellerId) where.sellerId = params.sellerId;
  else if (params.sellerIds?.length) where.sellerId = { in: params.sellerIds };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      createdAt: true,
      sellerId: true,
      seller: { select: { user: { select: { name: true } } } },
      customer: { select: { name: true } },
      items: {
        select: {
          productId: true,
          productName: true,
          quantity: true,
          unitPrice: true,
          commissionAmount: true,
          product: {
            select: {
              costPrice: true,
              supplierId: true,
              supplier: { select: { tradeName: true, legalName: true } },
            },
          },
        },
      },
    },
  });

  let totalRevenue = 0;
  let totalProductCost = 0;
  let totalCommission = 0;
  let linesMissingCost = 0;

  const bySeller = new Map<string, LineAcc>();
  const bySupplier = new Map<string, LineAcc>();
  const byProduct = new Map<string, LineAcc>();

  const byOrder = orders.map((o) => {
    let orderProductCost = 0;
    let orderCommission = 0;
    let orderItemRevenue = 0;

    for (const it of o.items) {
      const lineRevenue = decToNum(it.unitPrice) * it.quantity;
      const unitCost =
        it.product.costPrice != null ? decToNum(it.product.costPrice) : null;
      const lineCost = unitCost != null ? unitCost * it.quantity : 0;
      const lineCommission = decToNum(it.commissionAmount ?? 0);
      if (unitCost == null) linesMissingCost += 1;

      orderItemRevenue += lineRevenue;
      orderProductCost += lineCost;
      orderCommission += lineCommission;

      const sellerAcc = bySeller.get(o.sellerId) ?? {
        revenue: 0,
        productCost: 0,
        commission: 0,
        quantity: 0,
        label: o.seller.user.name,
        orderIds: new Set<string>(),
      };
      sellerAcc.revenue += lineRevenue;
      sellerAcc.productCost += lineCost;
      sellerAcc.commission += lineCommission;
      sellerAcc.quantity += it.quantity;
      sellerAcc.orderIds.add(o.id);
      bySeller.set(o.sellerId, sellerAcc);

      const supplierKey = it.product.supplierId ?? "__none__";
      const supplierLabel =
        it.product.supplier?.tradeName ??
        it.product.supplier?.legalName ??
        "Sem fornecedor";
      const supAcc = bySupplier.get(supplierKey) ?? {
        revenue: 0,
        productCost: 0,
        commission: 0,
        quantity: 0,
        label: supplierLabel,
        orderIds: new Set<string>(),
      };
      supAcc.revenue += lineRevenue;
      supAcc.productCost += lineCost;
      supAcc.commission += lineCommission;
      supAcc.quantity += it.quantity;
      supAcc.orderIds.add(o.id);
      bySupplier.set(supplierKey, supAcc);

      const prodAcc = byProduct.get(it.productId) ?? {
        revenue: 0,
        productCost: 0,
        commission: 0,
        quantity: 0,
        label: it.productName,
        orderIds: new Set<string>(),
      };
      prodAcc.revenue += lineRevenue;
      prodAcc.productCost += lineCost;
      prodAcc.commission += lineCommission;
      prodAcc.quantity += it.quantity;
      prodAcc.orderIds.add(o.id);
      byProduct.set(it.productId, prodAcc);
    }

    const revenue = roundMoney(decToNum(o.totalAmount));
    const productCost = roundMoney(orderProductCost);
    const commission = roundMoney(orderCommission);
    const profit = roundMoney(revenue - productCost - commission);

    totalRevenue += revenue;
    totalProductCost += productCost;
    totalCommission += commission;

    return {
      orderId: o.id,
      orderCode: orderCode(o),
      createdAt: o.createdAt.toISOString(),
      customerName: o.customer?.name ?? "—",
      sellerName: o.seller.user.name,
      revenue,
      productCost,
      commission,
      profit,
      marginPct: marginPct(profit, revenue),
      itemRevenue: roundMoney(orderItemRevenue),
    };
  });

  const orderCount = orders.length;
  const grossProfit = roundMoney(
    totalRevenue - totalProductCost - totalCommission,
  );
  const grossMarginPct = marginPct(grossProfit, totalRevenue);

  const includeFixedCosts = params.includeFixedCosts === true;
  let fixedCosts: number | undefined;
  let finalProfit: number | undefined;
  let finalMarginPct: number | undefined;
  let fixedCostsMeta: { monthlyBase: number; months: number } | undefined;

  if (includeFixedCosts) {
    const fx = await sumFixedExpensesForPeriod(
      params.organizationId,
      start,
      end,
    );
    fixedCosts = fx.total;
    fixedCostsMeta = { monthlyBase: fx.monthlyBase, months: fx.months };
    finalProfit = roundMoney(grossProfit - fixedCosts);
    finalMarginPct = marginPct(finalProfit, totalRevenue);
  }

  return {
    generatedAt: new Date().toISOString(),
    period: { from: start.toISOString(), to: end.toISOString() },
    includeFixedCosts,
    criteriaFooter: buildCriteriaFooter(includeFixedCosts),
    totals: {
      orderCount,
      revenue: roundMoney(totalRevenue),
      avgTicket: orderCount ? roundMoney(totalRevenue / orderCount) : 0,
      productCost: roundMoney(totalProductCost),
      commission: roundMoney(totalCommission),
      grossProfit,
      grossMarginPct,
      fixedCosts,
      finalProfit,
      finalMarginPct,
      linesMissingCost,
      fixedCostsMeta,
    },
    byOrder,
    bySeller: mapGroupedRows(bySeller),
    bySupplier: mapGroupedRows(bySupplier),
    byProduct: mapGroupedRows(byProduct),
  };
}
