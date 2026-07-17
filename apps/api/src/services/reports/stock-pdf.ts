import { prisma } from "../../db.js";
import { listStockProducts } from "../stock-ledger.js";
import { parseStockExtras, type StockExtraFilters } from "./extra-filters.js";
import {
  COLORS,
  drawEmptyState,
  drawHeader,
  drawTableFooter,
  drawTableHeader,
  drawTableRow,
  ensureSpace,
  PAGE,
  type PdfTable,
  withPdfDoc,
} from "./pdf-common.js";

export type StockPdfFilters = {
  organizationId: string;
  supplierId?: string;
  categoryId?: string;
  q?: string;
  extras?: Record<string, string>;
};

const TABLE: PdfTable = {
  columns: [
    { key: "name", label: "Produto", width: 155 },
    { key: "sku", label: "SKU", width: 70 },
    { key: "stock", label: "Saldo", width: 42, align: "right" },
    { key: "min", label: "Mín.", width: 38, align: "right" },
    { key: "supplier", label: "Fornecedor", width: 115 },
    { key: "category", label: "Grupo", width: 85 },
    { key: "expiring", label: "Validade", width: 42, align: "center" },
  ],
  rowHeight: 22,
};

export async function buildStockPdf(filters: StockPdfFilters): Promise<Buffer> {
  const extra: StockExtraFilters = filters.extras
    ? parseStockExtras(filters.extras)
    : {};

  const [org, listed] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: filters.organizationId },
      select: { name: true, displayName: true },
    }),
    listStockProducts({
      organizationId: filters.organizationId,
      supplierId: filters.supplierId,
      categoryId: filters.categoryId,
      q: filters.q,
      stockQtyMin: extra.stockQtyMin,
      stockQtyMax: extra.stockQtyMax,
      productLine: extra.productLine,
      blockSaleWhenOutOfStock: extra.blockSaleWhenOutOfStock,
    }),
  ]);

  let products = listed;
  if (extra.hasExpiringSoon === true) {
    products = products.filter((p) => p.hasExpiringSoon);
  } else if (extra.hasExpiringSoon === false) {
    products = products.filter((p) => !p.hasExpiringSoon);
  }

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

    drawTableHeader(doc, TABLE);

    products.forEach((p, index) => {
      drawTableRow(
        doc,
        TABLE,
        {
          name: p.name,
          sku: p.sku ?? "—",
          stock: String(p.stockQty),
          min: String(p.minStockQty),
          supplier: p.supplier?.tradeName ?? "—",
          category: p.category?.name ?? "—",
          expiring: p.hasExpiringSoon ? "⚠" : "—",
        },
        {
          index,
          onNewPage: () =>
            drawHeader(
              doc,
              "Relatório de Estoque (cont.)",
              orgName,
              `${products.length} produto(s)`,
            ),
        },
      );

      if (p.hasExpiringSoon && p.lots.length > 0) {
        const soon = p.lots
          .slice(0, 3)
          .map(
            (l) =>
              `${l.lotCode} (${l.qty}) até ${new Date(l.expiresAt).toLocaleDateString("pt-BR")}`,
          )
          .join(" · ");
        ensureSpace(doc, 14);
        doc
          .fillColor(COLORS.warn)
          .fontSize(7)
          .text(`Lotes próximos: ${soon}`, PAGE.left + 6, doc.y + 2, {
            width: PAGE.width - 12,
          });
        doc.fillColor(COLORS.text);
        doc.moveDown(0.35);
      }
    });

    const totalUnits = products.reduce((s, p) => s + p.stockQty, 0);
    const expiringCount = products.filter((p) => p.hasExpiringSoon).length;
    drawTableFooter(
      doc,
      `Produtos: ${products.length} · Com validade < 30d: ${expiringCount}`,
      `Total unidades: ${totalUnits}`,
    );
  });
}
