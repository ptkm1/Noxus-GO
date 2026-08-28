import type { StockCountSortBy, StockSituation } from "@pedidos/shared";
import {
  STOCK_COUNT_SORT_OPTIONS,
  STOCK_SITUATION_OPTIONS,
} from "@pedidos/shared";
import { prisma } from "../../db.js";
import {
  COLORS,
  drawEmptyState,
  drawHeader,
  drawTableFooter,
  drawTableHeader,
  ensureSpace,
  PAGE,
  withPdfDoc,
  type PdfCol,
  type PdfTable,
} from "./pdf-common.js";
import {
  loadStockReportProducts,
  sortStockReportProducts,
  type StockReportFilters,
} from "./stock-report-query.js";

export type StockCountPdfFilters = StockReportFilters & {
  sortBy?: StockCountSortBy;
  stockSituation?: StockSituation;
};

const TABLE: PdfTable = {
  columns: [
    { key: "sku", label: "Código interno", width: 72 },
    { key: "name", label: "Descrição", width: 168 },
    { key: "supplier", label: "Fornecedor", width: 118 },
    { key: "stock", label: "Estoque atual", width: 58, align: "right" },
    { key: "counted", label: "Qtd. contada", width: 131, align: "center" },
  ],
  rowHeight: 28,
  headerHeight: 24,
};

function colXs(columns: PdfCol[]): number[] {
  const xs: number[] = [];
  let x = PAGE.left;
  for (const c of columns) {
    xs.push(x);
    x += c.width;
  }
  return xs;
}

function drawCountRow(
  doc: PDFKit.PDFDocument,
  table: PdfTable,
  cells: Record<string, string>,
  opts?: { index?: number; onNewPage?: () => void },
) {
  const h = table.rowHeight ?? 28;
  const xs = colXs(table.columns);

  if (ensureSpace(doc, h + 2)) {
    opts?.onNewPage?.();
    drawTableHeader(doc, table);
  }

  const y = doc.y;
  const idx = opts?.index ?? 0;
  const bg = idx % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd;

  doc.rect(PAGE.left, y, PAGE.width, h).fill(bg);
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.4)
    .moveTo(PAGE.left, y + h)
    .lineTo(PAGE.right, y + h)
    .stroke();

  doc.fillColor(COLORS.text).fontSize(9).font("Helvetica");
  table.columns.forEach((col, i) => {
    const pad = 6;
    const x = xs[i]! + pad;
    const w = col.width - pad * 2;

    if (col.key === "counted") {
      const lineY = y + h - 10;
      doc
        .strokeColor(COLORS.text)
        .lineWidth(0.6)
        .moveTo(x + 8, lineY)
        .lineTo(x + w - 8, lineY)
        .stroke();
      return;
    }

    const text = cells[col.key] ?? "—";
    const align = col.align ?? "left";
    doc.text(text, x, y + 8, {
      width: w,
      align,
      lineBreak: false,
      ellipsis: align !== "right",
      height: h - 12,
    });
  });

  doc.y = y + h;
}

export async function buildStockCountPdf(
  filters: StockCountPdfFilters,
): Promise<Buffer> {
  const sortBy = filters.sortBy ?? "name";
  const stockSituation = filters.stockSituation ?? "with_stock";

  const [org, listed] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: filters.organizationId },
      select: { name: true, displayName: true },
    }),
    loadStockReportProducts({
      ...filters,
      stockSituation,
    }),
  ]);

  const products = sortStockReportProducts(listed, sortBy);
  const orgName = org?.displayName || org?.name || "";
  const sortLabel =
    STOCK_COUNT_SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Nome";
  const situationLabel =
    STOCK_SITUATION_OPTIONS.find((o) => o.value === stockSituation)?.label ??
    "Somente com estoque";

  return withPdfDoc((doc) => {
    drawHeader(
      doc,
      "Lista para Contagem de Estoque",
      orgName,
      `${products.length} produto(s) · Ordem: ${sortLabel} · ${situationLabel} · ${new Date().toLocaleString("pt-BR")}`,
    );

    if (products.length === 0) {
      drawEmptyState(doc, "Nenhum produto encontrado para os filtros.");
      return;
    }

    drawTableHeader(doc, TABLE);

    products.forEach((p, index) => {
      drawCountRow(
        doc,
        TABLE,
        {
          sku: p.sku ?? "—",
          name: p.name,
          supplier: p.supplier?.tradeName ?? p.supplier?.legalName ?? "—",
          stock: String(p.stockQty),
          counted: "",
        },
        {
          index,
          onNewPage: () =>
            drawHeader(
              doc,
              "Lista para Contagem de Estoque (cont.)",
              orgName,
              `${products.length} produto(s)`,
            ),
        },
      );
    });

    const totalUnits = products.reduce((s, p) => s + p.stockQty, 0);
    drawTableFooter(
      doc,
      `Produtos: ${products.length}`,
      `Total unidades (sistema): ${totalUnits}`,
    );
  });
}
