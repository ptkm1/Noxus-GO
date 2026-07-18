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

function orderWhere(filters: OrdersPdfFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    organizationId: filters.organizationId,
  };
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
              },
            },
          },
        },
      },
    }),
  ]);

  const orgName = org?.displayName || org?.name || "";

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
        drawInfoBar(doc, [
          { label: "Cliente:", value: o.customer?.name ?? "—" },
          { label: "Vendedor:", value: o.seller.user.name },
          {
            label: "Emissão:",
            value: `${o.createdAt.toLocaleString("pt-BR")} · ${STATUS_LABEL[o.status] ?? o.status}`,
          },
        ]);

        drawTableHeader(doc, ITEMS_TABLE);

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
          drawTableRow(
            doc,
            ITEMS_TABLE,
            {
              code:
                it.product?.sku ||
                it.product?.barcode ||
                it.productId.slice(0, 8),
              name: it.productName,
              qtyUnit: `${it.quantity} ${unitLabel}`,
              unit: money(unit),
              discount: money(disc * it.quantity),
              total: money(lineTotal),
            },
            {
              index: i,
              onNewPage: () =>
                drawHeader(doc, `Romaneio — Pedido ${code} (cont.)`, orgName),
            },
          );
        });

        drawTableFooter(
          doc,
          `Itens: ${o.items.length} · Subtotal: ${money(pageItemsTotal)}`,
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

    drawTableHeader(doc, ORDERS_TABLE);

    let sum = 0;
    orders.forEach((o, index) => {
      const amount = decToNum(o.totalAmount);
      sum += amount;
      drawTableRow(
        doc,
        ORDERS_TABLE,
        {
          code: orderCode(o),
          date: shortDateTime(o.createdAt),
          customer: shortName(o.customer?.name ?? "—", 16),
          seller: shortName(o.seller.user.name, 14),
          status: STATUS_LABEL[o.status] ?? o.status,
          items: String(o.items.length),
          total: money(amount),
        },
        {
          index,
          onNewPage: () =>
            drawHeader(
              doc,
              "Relatório de Pedidos (cont.)",
              orgName,
              `${orders.length} pedido(s)`,
            ),
        },
      );
    });

    drawTableFooter(
      doc,
      `Total de pedidos: ${orders.length}`,
      `Total geral: ${money(sum)}`,
    );
  });
}

export { orderWhere };
