import { prisma } from "../../db.js";
import { buildSalesBySupplier } from "../sales-by-supplier.js";
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

export type SalesBySupplierPdfFilters = {
  organizationId: string;
  sellerIds?: string[];
  from?: string;
  to?: string;
  limit?: number;
};

const TABLE: PdfTable = {
  columns: [
    { key: "supplier", label: "Fornecedor", width: 220 },
    { key: "orders", label: "Pedidos", width: 70, align: "right" },
    { key: "total", label: "Total", width: 120, align: "right" },
    { key: "share", label: "%", width: 80, align: "right" },
  ],
  rowHeight: 22,
};

/** Relatório de vendas por fornecedor (itens de pedidos confirmados). */
export async function buildSalesBySupplierPdf(
  filters: SalesBySupplierPdfFilters,
): Promise<Buffer> {
  const [summary, organization] = await Promise.all([
    buildSalesBySupplier({
      organizationId: filters.organizationId,
      sellerIds: filters.sellerIds,
      from: filters.from,
      to: filters.to,
      limit: filters.limit ?? 50,
    }),
    prisma.organization.findUnique({
      where: { id: filters.organizationId },
      select: { name: true, displayName: true },
    }),
  ]);

  const orgName = organization?.displayName || organization?.name || "";
  const grand = summary.totals.totalAmount;

  return withPdfDoc((doc) => {
    drawHeader(
      doc,
      "Vendas por fornecedor",
      orgName,
      `${summary.topSuppliers.length} fornecedor(es) · ${new Date().toLocaleString("pt-BR")}`,
    );
    drawInfoBar(doc, [
      {
        label: "Período:",
        value: `${new Date(summary.period.from).toLocaleDateString("pt-BR")} – ${new Date(summary.period.to).toLocaleDateString("pt-BR")}`,
      },
      {
        label: "Pedidos:",
        value: String(summary.totals.orderCount),
      },
      {
        label: "Total:",
        value: money(grand),
      },
    ]);

    if (summary.topSuppliers.length === 0) {
      drawEmptyState(doc, "Nenhuma venda confirmada no período.");
      return;
    }

    drawTableHeader(doc, TABLE);
    summary.topSuppliers.forEach((s, index) => {
      const share =
        grand > 0 ? `${((s.totalAmount / grand) * 100).toFixed(1)}%` : "—";
      drawTableRow(
        doc,
        TABLE,
        {
          supplier: s.tradeName,
          orders: String(s.orderCount),
          total: money(s.totalAmount),
          share,
        },
        {
          index,
          onNewPage: () =>
            drawHeader(
              doc,
              "Vendas por fornecedor (cont.)",
              orgName,
              `${summary.topSuppliers.length} fornecedor(es)`,
            ),
        },
      );
    });
    drawTableFooter(
      doc,
      `Fornecedores: ${summary.topSuppliers.length}`,
      `Total: ${money(grand)}`,
    );
  });
}
