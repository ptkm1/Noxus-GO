import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";
import {
    drawEmptyState,
    drawHeader,
    drawInfoBar,
    drawTableFooter,
    drawTableHeader,
    drawTableRow,
    money,
    withPdfDoc,
    type PdfTable,
} from "./pdf-common.js";

export type SalesByCustomerPdfFilters = {
  organizationId: string;
  sellerIds?: string[];
  from?: string;
  to?: string;
};

const TABLE: PdfTable = {
  columns: [
    { key: "customer", label: "Cliente", width: 200 },
    { key: "orders", label: "Pedidos", width: 70, align: "right" },
    { key: "total", label: "Total", width: 120, align: "right" },
    { key: "ticket", label: "Ticket méd.", width: 110, align: "right" },
  ],
  rowHeight: 22,
};

function ordersWhere(
  filters: SalesByCustomerPdfFilters,
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    organizationId: filters.organizationId,
    status: "CONFIRMED",
  };
  if (filters.sellerIds?.length) {
    where.sellerId = { in: filters.sellerIds };
  }
  const createdAt: Prisma.DateTimeFilter = {};
  if (filters.from) createdAt.gte = new Date(filters.from);
  if (filters.to) createdAt.lte = new Date(filters.to);
  if (Object.keys(createdAt).length) where.createdAt = createdAt;
  return where;
}

/** Relatório de vendas agregadas por cliente (confirmadas). */
export async function buildSalesByCustomerPdf(
  filters: SalesByCustomerPdfFilters,
): Promise<Buffer> {
  const [org, orders] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: filters.organizationId },
      select: { name: true, displayName: true },
    }),
    prisma.order.findMany({
      where: ordersWhere(filters),
      select: {
        totalAmount: true,
        customerId: true,
        customer: { select: { name: true, tradeName: true, legalName: true } },
      },
    }),
  ]);

  const byCustomer = new Map<
    string,
    { name: string; orderCount: number; totalAmount: number }
  >();

  for (const o of orders) {
    const key = o.customerId ?? "__none__";
    const name =
      o.customer?.tradeName?.trim() ||
      o.customer?.legalName?.trim() ||
      o.customer?.name?.trim() ||
      "Sem cliente";
    const row = byCustomer.get(key) ?? {
      name,
      orderCount: 0,
      totalAmount: 0,
    };
    row.orderCount += 1;
    row.totalAmount += decToNum(o.totalAmount);
    byCustomer.set(key, row);
  }

  const rows = [...byCustomer.values()].sort(
    (a, b) => b.totalAmount - a.totalAmount,
  );
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);
  const orgName = org?.displayName || org?.name || "";
  const infoLines: Array<{ label: string; value: string }> = [];
  if (filters.from) {
    infoLines.push({
      label: "De:",
      value: new Date(filters.from).toLocaleDateString("pt-BR"),
    });
  }
  if (filters.to) {
    infoLines.push({
      label: "Até:",
      value: new Date(filters.to).toLocaleDateString("pt-BR"),
    });
  }

  return withPdfDoc((doc) => {
    drawHeader(
      doc,
      "Vendas por cliente",
      orgName,
      `${rows.length} cliente(s) · ${new Date().toLocaleString("pt-BR")}`,
    );
    if (infoLines.length) drawInfoBar(doc, infoLines);

    if (rows.length === 0) {
      drawEmptyState(doc, "Nenhuma venda confirmada no período.");
      return;
    }

    drawTableHeader(doc, TABLE);
    rows.forEach((r, index) => {
      const ticket = r.orderCount ? r.totalAmount / r.orderCount : 0;
      drawTableRow(
        doc,
        TABLE,
        {
          customer: r.name,
          orders: String(r.orderCount),
          total: money(r.totalAmount),
          ticket: money(ticket),
        },
        {
          index,
          onNewPage: () =>
            drawHeader(
              doc,
              "Vendas por cliente (cont.)",
              orgName,
              `${rows.length} cliente(s)`,
            ),
        },
      );
    });
    drawTableFooter(
      doc,
      `Clientes: ${rows.length} · Pedidos: ${orders.length}`,
      `Total: ${money(grandTotal)}`,
    );
  });
}
