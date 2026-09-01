import type { StockValueBasis } from "@pedidos/shared";
import { STOCK_VALUE_PRICE_COLUMN_LABELS } from "@pedidos/shared";
import { prisma } from "../../db.js";
import {
  drawEmptyState,
  drawHeader,
  drawTableFooter,
  drawTableHeader,
  drawTableRow,
  money,
  withPdfDoc,
  type PdfTable,
} from "./pdf-common.js";
import { loadStockReportProducts } from "./stock-report-query.js";
import { loadStockUnitPrices, stockLineValue } from "./stock-value.js";

export type StockPdfFilters = {
  organizationId: string;
  supplierId?: string;
  categoryId?: string;
  q?: string;
  productIds?: string[];
  extras?: Record<string, string>;
  stockValueBasis?: StockValueBasis;
};

const TABLE: PdfTable = {
  columns: [
    { key: "name", label: "Produto", width: 175 },
    { key: "sku", label: "SKU", width: 70 },
    { key: "stock", label: "Saldo", width: 42, align: "right" },
    { key: "min", label: "Mín.", width: 38, align: "right" },
    { key: "supplier", label: "Fornecedor", width: 137 },
    { key: "category", label: "Grupo", width: 85 },
  ],
  rowHeight: 22,
};

/** Mesmas colunas base + preço e valor do estoque (soma = PAGE.width). */
function tableWithValue(basis: Exclude<StockValueBasis, "none">): PdfTable {
  return {
    columns: [
      { key: "name", label: "Produto", width: 126 },
      { key: "sku", label: "SKU", width: 55 },
      { key: "stock", label: "Saldo", width: 36, align: "right" },
      { key: "min", label: "Mín.", width: 32, align: "right" },
      { key: "supplier", label: "Fornecedor", width: 96 },
      { key: "category", label: "Grupo", width: 60 },
      {
        key: "unitPrice",
        label: STOCK_VALUE_PRICE_COLUMN_LABELS[basis],
        width: 70,
        align: "right",
      },
      {
        key: "stockValue",
        label: "Valor do Estoque",
        width: 72,
        align: "right",
      },
    ],
    rowHeight: 22,
  };
}

export async function buildStockPdf(filters: StockPdfFilters): Promise<Buffer> {
  const stockValueBasis = filters.stockValueBasis ?? "none";
  const showValue = stockValueBasis !== "none";

  const [org, products] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: filters.organizationId },
      select: { name: true, displayName: true },
    }),
    loadStockReportProducts({
      ...filters,
      stockSituation: "all",
    }),
  ]);

  const unitPrices =
    showValue && products.length > 0
      ? await loadStockUnitPrices({
          organizationId: filters.organizationId,
          productIds: products.map((p) => p.id),
          basis: stockValueBasis,
        })
      : new Map<string, number>();

  const table = showValue ? tableWithValue(stockValueBasis) : TABLE;
  const orgName = org?.displayName || org?.name || "";

  return withPdfDoc((doc) => {
    drawHeader(
      doc,
      "Relatório de Estoque",
      orgName,
      `${products.length} produto(s) · ${new Date().toLocaleString("pt-BR")}`,
    );

    if (products.length === 0) {
      drawEmptyState(doc, "Nenhum produto encontrado para os filtros.");
      return;
    }

    drawTableHeader(doc, table);

    let totalStockValue = 0;

    products.forEach((p, index) => {
      const unitPrice = unitPrices.get(p.id);
      const lineValue = showValue ? stockLineValue(p.stockQty, unitPrice) : 0;
      if (showValue) totalStockValue += lineValue;

      const row: Record<string, string> = {
        name: p.name,
        sku: p.sku ?? "—",
        stock: String(p.stockQty),
        min: String(p.minStockQty),
        supplier: p.supplier?.tradeName ?? "—",
        category: p.category?.name ?? "—",
      };

      if (showValue) {
        row.unitPrice = money(unitPrice ?? 0);
        row.stockValue = money(lineValue);
      }

      drawTableRow(doc, table, row, {
        index,
        onNewPage: () =>
          drawHeader(
            doc,
            "Relatório de Estoque (cont.)",
            orgName,
            `${products.length} produto(s)`,
          ),
      });
    });

    const totalUnits = products.reduce((s, p) => s + p.stockQty, 0);
    const leftFooter = `Produtos: ${products.length} · Total unidades: ${totalUnits}`;

    const rightFooter = showValue
      ? `Valor Total do Estoque: ${money(totalStockValue)}`
      : `Total unidades: ${totalUnits}`;

    drawTableFooter(doc, leftFooter, rightFooter);
  });
}
