import type { OrderStatus } from "@prisma/client";
import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";
import { orderWhere, type OrdersPdfFilters } from "./orders-pdf.js";
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
  withPdfDoc,
  type PdfTable,
} from "./pdf-common.js";

export type OrderItemsPdfFilters = OrdersPdfFilters & {
  groupByOrder?: boolean;
};

const ITEMS_TABLE: PdfTable = {
  columns: [
    { key: "order", label: "Pedido", width: 55 },
    { key: "code", label: "Código", width: 68 },
    { key: "name", label: "Produto", width: 155 },
    { key: "qtyUnit", label: "Qtd/un", width: 52, align: "right" },
    { key: "unit", label: "Vlr unit.", width: 70, align: "right" },
    { key: "discount", label: "Desc.", width: 60, align: "right" },
    { key: "total", label: "Val total", width: 87, align: "right" },
  ],
  rowHeight: 20,
};

const GROUPED_TABLE: PdfTable = {
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

export async function buildOrderItemsPdf(
  filters: OrderItemsPdfFilters,
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

  function itemRows(o: (typeof orders)[number]) {
    return o.items.map((it) => {
      const unit = decToNum(it.unitPrice);
      const disc = lineDiscount({
        unitPrice: it.unitPrice,
        basePrice: it.product?.basePrice,
      });
      const unitLabel = it.product?.purchaseUnit?.trim() || "UN";
      return {
        code:
          it.product?.sku || it.product?.barcode || it.productId.slice(0, 8),
        name: it.productName,
        qtyUnit: `${it.quantity} ${unitLabel}`,
        unit,
        discount: disc * it.quantity,
        total: unit * it.quantity,
      };
    });
  }

  if (filters.groupByOrder) {
    return withPdfDoc((doc) => {
      if (orders.length === 0) {
        drawHeader(doc, "Relatório de Itens de Pedidos", orgName);
        drawEmptyState(doc, "Nenhum item encontrado.");
        return;
      }
      orders.forEach((o, idx) => {
        if (idx > 0) doc.addPage();
        drawHeader(
          doc,
          `Itens — Pedido ${orderCode(o)}`,
          orgName,
          `${idx + 1} de ${orders.length}`,
        );
        drawInfoBar(doc, [
          { label: "Cliente:", value: o.customer?.name ?? "—" },
          { label: "Vendedor:", value: o.seller.user.name },
          {
            label: "Emissão:",
            value: o.createdAt.toLocaleString("pt-BR"),
          },
        ]);
        drawTableHeader(doc, GROUPED_TABLE);
        let sum = 0;
        const rows = itemRows(o);
        rows.forEach((row, i) => {
          sum += row.total;
          drawTableRow(
            doc,
            GROUPED_TABLE,
            {
              code: row.code,
              name: row.name,
              qtyUnit: row.qtyUnit,
              unit: money(row.unit),
              discount: money(row.discount),
              total: money(row.total),
            },
            {
              index: i,
              onNewPage: () =>
                drawHeader(
                  doc,
                  `Itens — Pedido ${orderCode(o)} (cont.)`,
                  orgName,
                ),
            },
          );
        });
        drawTableFooter(doc, `Itens: ${rows.length}`, `Total: ${money(sum)}`);
      });
    });
  }

  return withPdfDoc((doc) => {
    const all = orders.flatMap((o) =>
      itemRows(o).map((row) => ({
        ...row,
        orderLabel: orderCode(o),
      })),
    );

    drawHeader(
      doc,
      "Relatório de Itens de Pedidos",
      orgName,
      `${all.length} item(ns) · ${new Date().toLocaleString("pt-BR")}`,
    );

    if (all.length === 0) {
      drawEmptyState(doc, "Nenhum item encontrado.");
      return;
    }

    drawTableHeader(doc, ITEMS_TABLE);
    let sum = 0;
    all.forEach((row, index) => {
      sum += row.total;
      drawTableRow(
        doc,
        ITEMS_TABLE,
        {
          order: row.orderLabel,
          code: row.code,
          name: row.name,
          qtyUnit: row.qtyUnit,
          unit: money(row.unit),
          discount: money(row.discount),
          total: money(row.total),
        },
        {
          index,
          onNewPage: () =>
            drawHeader(
              doc,
              "Relatório de Itens (cont.)",
              orgName,
              `${all.length} item(ns)`,
            ),
        },
      );
    });

    drawTableFooter(
      doc,
      `Total de linhas: ${all.length}`,
      `Total geral: ${money(sum)}`,
    );
  });
}

export type { OrderStatus };
