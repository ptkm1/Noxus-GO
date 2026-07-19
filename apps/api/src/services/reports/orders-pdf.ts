import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";
import { applyOrderExtras } from "./extra-filters.js";
import {
  drawEmptyState,
  drawHeader,
  drawInfoBar,
  drawTableFooter,
  drawTableHeader,
  drawTableRow,
  lineDiscount,
  money,
  orderCode,
  shortDateTime,
  shortName,
  withPdfDoc,
  type PdfTable,
} from "./pdf-common.js";

export type OrdersPdfFilters = {
  organizationId: string;
  sellerId?: string;
  customerId?: string;
  from?: string;
  to?: string;
  status?: OrderStatus;
  romaneio?: boolean;
  /** When set, report includes only these order IDs (still scoped to org). */
  orderIds?: string[];
  /** Include profit margin % columns (same formula as /reports/margin). */
  includeProfitPercent?: boolean;
  extras?: Record<string, string>;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  PENDING_CREDIT_APPROVAL: "Aguardando crédito",
};

const ORDERS_TABLE: PdfTable = {
  columns: [
    { key: "code", label: "Código", width: 58 },
    { key: "date", label: "Data", width: 88 },
    { key: "customer", label: "Cliente", width: 100 },
    { key: "seller", label: "Vendedor", width: 88 },
    { key: "status", label: "Situação", width: 78 },
    { key: "items", label: "Itens", width: 35, align: "right" },
    { key: "total", label: "Total", width: 100, align: "right" },
  ],
  rowHeight: 22,
};

/** Same columns as ORDERS_TABLE, with Lucro %; widths sum to PAGE.width (547). */
const ORDERS_TABLE_WITH_PROFIT: PdfTable = {
  columns: [
    { key: "code", label: "Código", width: 52 },
    { key: "date", label: "Data", width: 78 },
    { key: "customer", label: "Cliente", width: 88 },
    { key: "seller", label: "Vendedor", width: 76 },
    { key: "status", label: "Situação", width: 70 },
    { key: "items", label: "Itens", width: 32, align: "right" },
    { key: "total", label: "Total", width: 88, align: "right" },
    { key: "profitPct", label: "Lucro %", width: 63, align: "right" },
  ],
  rowHeight: 22,
};

const ITEMS_TABLE: PdfTable = {
  columns: [
    { key: "code", label: "Código", width: 72 },
    { key: "name", label: "Produto", width: 180 },
    { key: "qtyUnit", label: "Qtd/un", width: 55, align: "right" },
    { key: "unit", label: "Vlr unit.", width: 75, align: "right" },
    { key: "discount", label: "Desc.", width: 70, align: "right" },
    { key: "total", label: "Val total", width: 95, align: "right" },
  ],
  rowHeight: 20,
};

const ITEMS_TABLE_WITH_PROFIT: PdfTable = {
  columns: [
    { key: "code", label: "Código", width: 62 },
    { key: "name", label: "Produto", width: 150 },
    { key: "qtyUnit", label: "Qtd/un", width: 50, align: "right" },
    { key: "unit", label: "Vlr unit.", width: 68, align: "right" },
    { key: "discount", label: "Desc.", width: 58, align: "right" },
    { key: "total", label: "Val total", width: 82, align: "right" },
    { key: "profitPct", label: "Lucro %", width: 77, align: "right" },
  ],
  rowHeight: 20,
};

/**
 * Margem % sobre a receita (igual ao relatório de margem):
 * ((receita − custo) / receita) × 100, com custo = costPrice × qtd.
 * Retorna null se não houver costPrice em nenhum item ou receita ≤ 0.
 */
function profitPercent(
  revenue: number,
  cost: number,
  hasCost: boolean,
): number | null {
  if (!hasCost || revenue <= 0) return null;
  return ((revenue - cost) / revenue) * 100;
}

function formatProfitPct(pct: number | null): string {
  if (pct == null) return "—";
  return `${pct.toFixed(1).replace(".", ",")}%`;
}

type OrderItemForProfit = {
  quantity: number;
  unitPrice: unknown;
  product: { costPrice?: unknown | null } | null;
};

function lineProfitParts(it: OrderItemForProfit): {
  revenue: number;
  cost: number;
  hasCost: boolean;
} {
  const revenue = decToNum(it.unitPrice) * it.quantity;
  const unitCost =
    it.product?.costPrice != null ? decToNum(it.product.costPrice) : null;
  return {
    revenue,
    cost: unitCost != null ? unitCost * it.quantity : 0,
    hasCost: unitCost != null,
  };
}

function orderProfitPercent(items: OrderItemForProfit[]): number | null {
  let revenue = 0;
  let cost = 0;
  let hasCost = false;
  for (const it of items) {
    const p = lineProfitParts(it);
    revenue += p.revenue;
    cost += p.cost;
    if (p.hasCost) hasCost = true;
  }
  return profitPercent(revenue, cost, hasCost);
}

function orderWhere(filters: OrdersPdfFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    organizationId: filters.organizationId,
  };
  if (filters.orderIds?.length) {
    where.id = { in: filters.orderIds };
    return where;
  }
  if (filters.sellerId) where.sellerId = filters.sellerId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.status) where.status = filters.status;
  const createdAt: Prisma.DateTimeFilter = {};
  if (filters.from) createdAt.gte = new Date(filters.from);
  if (filters.to) createdAt.lte = new Date(filters.to);
  if (Object.keys(createdAt).length) where.createdAt = createdAt;
  if (filters.extras) applyOrderExtras(where, filters.extras);
  return where;
}

export async function buildOrdersPdf(
  filters: OrdersPdfFilters,
): Promise<Buffer> {
  const withProfit = filters.includeProfitPercent === true;
  const [org, orders] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: filters.organizationId },
      select: { name: true, displayName: true },
    }),
    prisma.order.findMany({
      where: orderWhere(filters),
      orderBy: { createdAt: "asc" },
      include: {
        seller: { include: { user: { select: { name: true } } } },
        customer: { select: { name: true } },
        items: {
          include: {
            product: {
              select: {
                sku: true,
                barcode: true,
                purchaseUnit: true,
                basePrice: true,
                ...(withProfit ? { costPrice: true } : {}),
              },
            },
          },
        },
      },
    }),
  ]);

  const orgName = org?.displayName || org?.name || "";
  const itemsTable = withProfit ? ITEMS_TABLE_WITH_PROFIT : ITEMS_TABLE;
  const ordersTable = withProfit ? ORDERS_TABLE_WITH_PROFIT : ORDERS_TABLE;

  if (filters.romaneio) {
    return withPdfDoc((doc) => {
      if (orders.length === 0) {
        drawHeader(doc, "Romaneio de Pedidos", orgName);
        drawEmptyState(doc, "Nenhum pedido encontrado para os filtros.");
        return;
      }

      orders.forEach((o, idx) => {
        if (idx > 0) doc.addPage();
        const code = orderCode(o);
        drawHeader(
          doc,
          `Romaneio — Pedido ${code}`,
          orgName,
          `${idx + 1} de ${orders.length}`,
        );
        const infoItems: { label: string; value: string }[] = [
          { label: "Cliente:", value: o.customer?.name ?? "—" },
          { label: "Vendedor:", value: o.seller.user.name },
          {
            label: "Emissão:",
            value: `${o.createdAt.toLocaleString("pt-BR")} · ${STATUS_LABEL[o.status] ?? o.status}`,
          },
        ];
        if (withProfit) {
          infoItems.push({
            label: "Lucro %:",
            value: formatProfitPct(orderProfitPercent(o.items)),
          });
        }
        drawInfoBar(doc, infoItems);

        drawTableHeader(doc, itemsTable);

        let pageItemsTotal = 0;
        o.items.forEach((it, i) => {
          const unit = decToNum(it.unitPrice);
          const disc = lineDiscount({
            unitPrice: it.unitPrice,
            basePrice: it.product?.basePrice,
          });
          const lineTotal = unit * it.quantity;
          pageItemsTotal += lineTotal;
          const unitLabel = it.product?.purchaseUnit?.trim() || "UN";
          const row: Record<string, string> = {
            code:
              it.product?.sku ||
              it.product?.barcode ||
              it.productId.slice(0, 8),
            name: it.productName,
            qtyUnit: `${it.quantity} ${unitLabel}`,
            unit: money(unit),
            discount: money(disc * it.quantity),
            total: money(lineTotal),
          };
          if (withProfit) {
            const parts = lineProfitParts(it);
            row.profitPct = formatProfitPct(
              profitPercent(parts.revenue, parts.cost, parts.hasCost),
            );
          }
          drawTableRow(doc, itemsTable, row, {
            index: i,
            onNewPage: () =>
              drawHeader(doc, `Romaneio — Pedido ${code} (cont.)`, orgName),
          });
        });

        const footerLeft = withProfit
          ? `Itens: ${o.items.length} · Subtotal: ${money(pageItemsTotal)} · Lucro %: ${formatProfitPct(orderProfitPercent(o.items))}`
          : `Itens: ${o.items.length} · Subtotal: ${money(pageItemsTotal)}`;
        drawTableFooter(
          doc,
          footerLeft,
          `Total pedido: ${money(decToNum(o.totalAmount))}`,
        );
      });
    });
  }

  return withPdfDoc((doc) => {
    drawHeader(
      doc,
      "Relatório de Pedidos",
      orgName,
      `${orders.length} pedido(s) · ${new Date().toLocaleString("pt-BR")}`,
    );

    if (orders.length === 0) {
      drawEmptyState(doc, "Nenhum pedido encontrado para os filtros.");
      return;
    }

    drawTableHeader(doc, ordersTable);

    let sum = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let anyCost = false;
    orders.forEach((o, index) => {
      const amount = decToNum(o.totalAmount);
      sum += amount;
      const row: Record<string, string> = {
        code: orderCode(o),
        date: shortDateTime(o.createdAt),
        customer: shortName(o.customer?.name ?? "—", withProfit ? 14 : 16),
        seller: shortName(o.seller.user.name, withProfit ? 12 : 14),
        status: STATUS_LABEL[o.status] ?? o.status,
        items: String(o.items.length),
        total: money(amount),
      };
      if (withProfit) {
        for (const it of o.items) {
          const p = lineProfitParts(it);
          totalRevenue += p.revenue;
          totalCost += p.cost;
          if (p.hasCost) anyCost = true;
        }
        row.profitPct = formatProfitPct(orderProfitPercent(o.items));
      }
      drawTableRow(doc, ordersTable, row, {
        index,
        onNewPage: () =>
          drawHeader(
            doc,
            "Relatório de Pedidos (cont.)",
            orgName,
            `${orders.length} pedido(s)`,
          ),
      });
    });

    const footerLeft = withProfit
      ? `Total de pedidos: ${orders.length} · Lucro % médio: ${formatProfitPct(profitPercent(totalRevenue, totalCost, anyCost))}`
      : `Total de pedidos: ${orders.length}`;
    drawTableFooter(doc, footerLeft, `Total geral: ${money(sum)}`);
  });
}

export { orderWhere };
