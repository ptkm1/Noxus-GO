import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";
import {
  drawHeader,
  drawTableHeader,
  drawTableRow,
  money,
  PAGE,
  withPdfDoc,
  type PdfTable,
} from "./reports/pdf-common.js";

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
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  return { start, end: now };
}

function previousPeriod(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);
  return { start: prevStart, end: prevEnd };
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcMonthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function utcWeekKey(d: Date): string {
  const day = d.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset),
  );
  return utcDayKey(monday);
}

function daysInclusiveUtc(a: Date, b: Date): number {
  const start = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((end - start) / 86_400_000) + 1;
}

/** Rateia o valor mensal das despesas fixas ativas pelos dias do período. */
export async function sumProratedFixedCosts(params: {
  organizationId: string;
  start: Date;
  end: Date;
}): Promise<number> {
  const templates = await prisma.operationalFixedExpense.findMany({
    where: { organizationId: params.organizationId, active: true },
    select: { amount: true },
  });
  if (templates.length === 0) return 0;
  const monthly = templates.reduce((acc, row) => acc + decToNum(row.amount), 0);
  if (monthly <= 0) return 0;

  let fraction = 0;
  let cursor = new Date(
    Date.UTC(params.start.getUTCFullYear(), params.start.getUTCMonth(), 1),
  );
  const last = new Date(
    Date.UTC(params.end.getUTCFullYear(), params.end.getUTCMonth(), 1),
  );
  while (cursor <= last) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
    const overlapStart =
      params.start > monthStart ? params.start : monthStart;
    const overlapEnd = params.end < monthEnd ? params.end : monthEnd;
    if (overlapStart <= overlapEnd) {
      const monthDays = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      fraction += daysInclusiveUtc(overlapStart, overlapEnd) / monthDays;
    }
    cursor = new Date(Date.UTC(y, m + 1, 1));
  }
  return roundMoney(monthly * fraction);
}

export type FinancialPeriodGroup = "day" | "week" | "month";

export type FinancialResultTotals = {
  orderCount: number;
  revenue: number;
  avgTicket: number;
  productCost: number;
  commission: number;
  profit: number;
  marginPct: number;
  fixedCosts: number;
  finalProfit: number;
  finalMarginPct: number;
  linesMissingCost: number;
};

type Acc = {
  label: string;
  orderIds: Set<string>;
  revenue: number;
  productCost: number;
  commission: number;
};

function emptyAcc(label: string): Acc {
  return {
    label,
    orderIds: new Set(),
    revenue: 0,
    productCost: 0,
    commission: 0,
  };
}

function accRow(id: string, a: Acc) {
  const profit = roundMoney(a.revenue - a.productCost - a.commission);
  const marginPct =
    a.revenue > 0 ? roundMoney((profit / a.revenue) * 100) : 0;
  return {
    id,
    label: a.label,
    orderCount: a.orderIds.size,
    revenue: roundMoney(a.revenue),
    productCost: roundMoney(a.productCost),
    commission: roundMoney(a.commission),
    profit,
    marginPct,
  };
}

function totalsFromParts(parts: {
  orderCount: number;
  revenue: number;
  productCost: number;
  commission: number;
  linesMissingCost: number;
  fixedCosts: number;
  includeFixedCosts: boolean;
}): FinancialResultTotals {
  const profit = roundMoney(
    parts.revenue - parts.productCost - parts.commission,
  );
  const marginPct =
    parts.revenue > 0 ? roundMoney((profit / parts.revenue) * 100) : 0;
  const fixed = parts.includeFixedCosts ? parts.fixedCosts : 0;
  const finalProfit = roundMoney(profit - fixed);
  const finalMarginPct =
    parts.revenue > 0 ? roundMoney((finalProfit / parts.revenue) * 100) : 0;
  return {
    orderCount: parts.orderCount,
    revenue: roundMoney(parts.revenue),
    avgTicket:
      parts.orderCount > 0
        ? roundMoney(parts.revenue / parts.orderCount)
        : 0,
    productCost: roundMoney(parts.productCost),
    commission: roundMoney(parts.commission),
    profit,
    marginPct,
    fixedCosts: roundMoney(fixed),
    finalProfit,
    finalMarginPct,
    linesMissingCost: parts.linesMissingCost,
  };
}

function evolutionPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return roundMoney(((current - previous) / Math.abs(previous)) * 100);
}

const CRITERIA_WITHOUT_FIXED =
  "Critérios deste relatório: Resultado calculado com base no faturamento das vendas, descontando o custo dos produtos vendidos e as comissões pagas. Não foram considerados impostos, fretes, taxas ou outros custos. Custos fixos não foram considerados neste resultado.";

const CRITERIA_WITH_FIXED =
  "Critérios deste relatório: Resultado calculado com base no faturamento das vendas, descontando o custo dos produtos vendidos, as comissões pagas e os custos fixos cadastrados para o período. Não foram considerados impostos, fretes, taxas ou outros custos.";

const orderSelect = {
  id: true,
  orderNumber: true,
  sellerId: true,
  createdAt: true,
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
} as const;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

async function loadOrders(params: {
  organizationId: string;
  start: Date;
  end: Date;
  sellerIds?: string[];
}): Promise<OrderRow[]> {
  const where: Prisma.OrderWhereInput = {
    organizationId: params.organizationId,
    status: "CONFIRMED",
    createdAt: { gte: params.start, lte: params.end },
  };
  if (params.sellerIds?.length) where.sellerId = { in: params.sellerIds };
  return prisma.order.findMany({
    where,
    select: orderSelect,
    orderBy: { createdAt: "asc" },
  });
}

function aggregateOrders(
  orders: OrderRow[],
  periodGroup: FinancialPeriodGroup,
): {
  orderCount: number;
  revenue: number;
  productCost: number;
  commission: number;
  linesMissingCost: number;
  byOrder: Array<{
    orderId: string;
    orderNumber: string;
    date: string;
    customer: string;
    seller: string;
    revenue: number;
    productCost: number;
    commission: number;
    profit: number;
    marginPct: number;
  }>;
  bySeller: Map<string, Acc>;
  bySupplier: Map<string, Acc>;
  byProduct: Map<string, Acc>;
  byPeriod: Map<string, Acc>;
} {
  const bySeller = new Map<string, Acc>();
  const bySupplier = new Map<string, Acc>();
  const byProduct = new Map<string, Acc>();
  const byPeriod = new Map<string, Acc>();
  const byOrder: Array<{
    orderId: string;
    orderNumber: string;
    date: string;
    customer: string;
    seller: string;
    revenue: number;
    productCost: number;
    commission: number;
    profit: number;
    marginPct: number;
  }> = [];

  let revenue = 0;
  let productCost = 0;
  let commission = 0;
  let linesMissingCost = 0;

  function bump(map: Map<string, Acc>, id: string, label: string, delta: {
    orderId: string;
    revenue: number;
    productCost: number;
    commission: number;
  }) {
    const acc = map.get(id) ?? emptyAcc(label);
    acc.orderIds.add(delta.orderId);
    acc.revenue += delta.revenue;
    acc.productCost += delta.productCost;
    acc.commission += delta.commission;
    map.set(id, acc);
  }

  for (const order of orders) {
    let orderRevenue = 0;
    let orderCost = 0;
    let orderCommission = 0;
    for (const item of order.items) {
      const lineRevenue = decToNum(item.unitPrice) * item.quantity;
      const unitCost =
        item.product.costPrice != null ? decToNum(item.product.costPrice) : null;
      const lineCost = unitCost != null ? unitCost * item.quantity : 0;
      if (unitCost == null) linesMissingCost += 1;
      const lineCommission = item.commissionAmount
        ? decToNum(item.commissionAmount)
        : 0;

      orderRevenue += lineRevenue;
      orderCost += lineCost;
      orderCommission += lineCommission;

      const delta = {
        orderId: order.id,
        revenue: lineRevenue,
        productCost: lineCost,
        commission: lineCommission,
      };
      bump(bySeller, order.sellerId, order.seller.user.name, delta);
      bump(
        byProduct,
        item.productId,
        item.productName,
        delta,
      );
      const supplierId = item.product.supplierId ?? "_none";
      const supplierLabel =
        item.product.supplier?.tradeName ??
        item.product.supplier?.legalName ??
        "Sem fornecedor";
      bump(bySupplier, supplierId, supplierLabel, delta);
    }

    revenue += orderRevenue;
    productCost += orderCost;
    commission += orderCommission;

    const profit = roundMoney(orderRevenue - orderCost - orderCommission);
    const marginPct =
      orderRevenue > 0 ? roundMoney((profit / orderRevenue) * 100) : 0;
    byOrder.push({
      orderId: order.id,
      orderNumber:
        order.orderNumber != null ? String(order.orderNumber) : order.id.slice(-6),
      date: order.createdAt.toISOString(),
      customer: order.customer?.name ?? "—",
      seller: order.seller.user.name,
      revenue: roundMoney(orderRevenue),
      productCost: roundMoney(orderCost),
      commission: roundMoney(orderCommission),
      profit,
      marginPct,
    });

    const periodKey =
      periodGroup === "month"
        ? utcMonthKey(order.createdAt)
        : periodGroup === "week"
          ? utcWeekKey(order.createdAt)
          : utcDayKey(order.createdAt);
    bump(byPeriod, periodKey, periodKey, {
      orderId: order.id,
      revenue: orderRevenue,
      productCost: orderCost,
      commission: orderCommission,
    });
  }

  return {
    orderCount: orders.length,
    revenue,
    productCost,
    commission,
    linesMissingCost,
    byOrder,
    bySeller,
    bySupplier,
    byProduct,
    byPeriod,
  };
}

function mapAcc(map: Map<string, Acc>) {
  return [...map.entries()]
    .map(([id, acc]) => accRow(id, acc))
    .sort((a, b) => b.profit - a.profit);
}

export type FinancialResultReport = {
  generatedAt: string;
  includeFixedCosts: boolean;
  periodGroup: FinancialPeriodGroup;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  criteria: string;
  totals: FinancialResultTotals;
  previous: FinancialResultTotals;
  evolution: {
    revenuePct: number | null;
    profitPct: number | null;
    finalProfitPct: number | null;
    marginPctPoints: number;
  };
  byOrder: ReturnType<typeof aggregateOrders>["byOrder"];
  bySeller: ReturnType<typeof mapAcc>;
  bySupplier: ReturnType<typeof mapAcc>;
  byProduct: ReturnType<typeof mapAcc>;
  byPeriod: ReturnType<typeof mapAcc>;
};

const MAX_ORDER_ROWS = 400;

export async function buildFinancialResult(params: {
  organizationId: string;
  from?: string;
  to?: string;
  sellerIds?: string[];
  includeFixedCosts?: boolean;
  periodGroup?: FinancialPeriodGroup;
}): Promise<FinancialResultReport> {
  const includeFixedCosts = Boolean(params.includeFixedCosts);
  const periodGroup = params.periodGroup ?? "day";
  const { start, end } = resolvePeriod(params.from, params.to);
  const prev = previousPeriod(start, end);

  const [orders, prevOrders, fixedCosts, prevFixedCosts] = await Promise.all([
    loadOrders({
      organizationId: params.organizationId,
      start,
      end,
      sellerIds: params.sellerIds,
    }),
    loadOrders({
      organizationId: params.organizationId,
      start: prev.start,
      end: prev.end,
      sellerIds: params.sellerIds,
    }),
    includeFixedCosts
      ? sumProratedFixedCosts({
          organizationId: params.organizationId,
          start,
          end,
        })
      : Promise.resolve(0),
    includeFixedCosts
      ? sumProratedFixedCosts({
          organizationId: params.organizationId,
          start: prev.start,
          end: prev.end,
        })
      : Promise.resolve(0),
  ]);

  const current = aggregateOrders(orders, periodGroup);
  const previous = aggregateOrders(prevOrders, periodGroup);

  const totals = totalsFromParts({
    ...current,
    fixedCosts,
    includeFixedCosts,
  });
  const previousTotals = totalsFromParts({
    ...previous,
    fixedCosts: prevFixedCosts,
    includeFixedCosts,
  });

  return {
    generatedAt: new Date().toISOString(),
    includeFixedCosts,
    periodGroup,
    period: { from: start.toISOString(), to: end.toISOString() },
    previousPeriod: {
      from: prev.start.toISOString(),
      to: prev.end.toISOString(),
    },
    criteria: includeFixedCosts ? CRITERIA_WITH_FIXED : CRITERIA_WITHOUT_FIXED,
    totals,
    previous: previousTotals,
    evolution: {
      revenuePct: evolutionPct(totals.revenue, previousTotals.revenue),
      profitPct: evolutionPct(totals.profit, previousTotals.profit),
      finalProfitPct: evolutionPct(
        totals.finalProfit,
        previousTotals.finalProfit,
      ),
      marginPctPoints: roundMoney(
        (includeFixedCosts ? totals.finalMarginPct : totals.marginPct) -
          (includeFixedCosts
            ? previousTotals.finalMarginPct
            : previousTotals.marginPct),
      ),
    },
    byOrder: current.byOrder.slice(0, MAX_ORDER_ROWS),
    bySeller: mapAcc(current.bySeller),
    bySupplier: mapAcc(current.bySupplier),
    byProduct: mapAcc(current.byProduct).slice(0, 80),
    byPeriod: mapAcc(current.byPeriod).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  };
}

function fmtPct(n: number): string {
  return `${n.toFixed(2).replace(".", ",")}%`;
}

function fmtPeriodLabel(fromIso: string, toIso: string): string {
  const from = new Date(fromIso).toLocaleDateString("pt-BR");
  const to = new Date(toIso).toLocaleDateString("pt-BR");
  return `${from} — ${to}`;
}

export async function buildFinancialResultPdf(params: {
  organizationId: string;
  orgName?: string | null;
  from?: string;
  to?: string;
  sellerIds?: string[];
  includeFixedCosts?: boolean;
  periodGroup?: FinancialPeriodGroup;
}): Promise<Buffer> {
  const report = await buildFinancialResult(params);
  const t = report.totals;
  const p = report.previous;
  const profitKey = report.includeFixedCosts ? "finalProfit" : "profit";
  const marginKey = report.includeFixedCosts ? "finalMarginPct" : "marginPct";

  return withPdfDoc((doc) => {
    drawHeader(
      doc,
      "Resultado financeiro",
      params.orgName ?? undefined,
      fmtPeriodLabel(report.period.from, report.period.to),
    );
    if (report.includeFixedCosts) {
      doc
        .fillColor("#b45309")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("Custos fixos considerados neste resultado.", PAGE.left, doc.y, {
          width: PAGE.width,
        });
      doc.moveDown(0.4);
    }

    const kpis: Array<[string, string]> = [
      ["Pedidos", String(t.orderCount)],
      ["Faturamento", money(t.revenue)],
      ["Ticket médio", money(t.avgTicket)],
      ["Custo dos produtos", money(t.productCost)],
      ["Comissões", money(t.commission)],
      ["Lucro", money(t.profit)],
      ["Margem", fmtPct(t.marginPct)],
    ];
    if (report.includeFixedCosts) {
      kpis.push(
        ["Custos fixos", money(t.fixedCosts)],
        ["Lucro final", money(t.finalProfit)],
        ["Margem final", fmtPct(t.finalMarginPct)],
      );
    }

    doc.fillColor("#0f172a").fontSize(9).font("Helvetica");
    for (const [label, value] of kpis) {
      doc.text(`${label}: ${value}`, PAGE.left, doc.y, { width: PAGE.width / 2 });
    }
    doc.moveDown(0.6);
    doc
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        `Período anterior (${fmtPeriodLabel(report.previousPeriod.from, report.previousPeriod.to)}): Faturamento ${money(p.revenue)} · Lucro ${money(p[profitKey])} · Margem ${fmtPct(p[marginKey])}`,
        PAGE.left,
        doc.y,
        { width: PAGE.width },
      );
    const evo = report.includeFixedCosts
      ? report.evolution.finalProfitPct
      : report.evolution.profitPct;
    doc.text(
      `Evolução do lucro: ${evo == null ? "—" : `${evo > 0 ? "+" : ""}${fmtPct(evo)}`}`,
      PAGE.left,
      doc.y,
      { width: PAGE.width },
    );
    doc.moveDown(0.8);

    const table: PdfTable = {
      columns: [
        { key: "order", label: "Pedido", width: 52 },
        { key: "date", label: "Data", width: 72 },
        { key: "customer", label: "Cliente", width: 110 },
        { key: "revenue", label: "Venda", width: 68, align: "right" },
        { key: "cost", label: "Custo", width: 68, align: "right" },
        { key: "commission", label: "Comissão", width: 68, align: "right" },
        { key: "profit", label: "Lucro", width: 68, align: "right" },
        { key: "margin", label: "Margem", width: 41, align: "right" },
      ],
      rowHeight: 16,
      headerHeight: 18,
    };
    drawTableHeader(doc, table);
    report.byOrder.forEach((row, index) => {
      drawTableRow(
        doc,
        table,
        {
          order: row.orderNumber,
          date: new Date(row.date).toLocaleDateString("pt-BR"),
          customer: row.customer,
          revenue: money(row.revenue),
          cost: money(row.productCost),
          commission: money(row.commission),
          profit: money(row.profit),
          margin: fmtPct(row.marginPct),
        },
        { index },
      );
    });

    doc.moveDown(1.2);
    doc
      .fillColor("#64748b")
      .fontSize(8)
      .font("Helvetica")
      .text(report.criteria, PAGE.left, doc.y, {
        width: PAGE.width,
        align: "left",
      });
    if (t.linesMissingCost > 0) {
      doc.moveDown(0.4);
      doc.text(
        `${t.linesMissingCost} linha(s) sem custo cadastrado (consideradas com custo zero).`,
        PAGE.left,
        doc.y,
        { width: PAGE.width },
      );
    }
  });
}
