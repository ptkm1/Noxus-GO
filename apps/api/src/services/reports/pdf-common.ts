import PDFDocument from "pdfkit";
import { decToNum } from "../../util/money.js";

export const PAGE = {
  /** A4 = 595.28pt; margens menores para usar quase 100% da largura. */
  left: 24,
  right: 571,
  width: 547,
} as const;

export const COLORS = {
  text: "#0f172a",
  muted: "#64748b",
  headerBg: "#0f172a",
  headerFg: "#ffffff",
  rowEven: "#ffffff",
  rowOdd: "#f1f5f9",
  border: "#cbd5e1",
  accent: "#0284c7",
  warn: "#b45309",
} as const;

export function money(n: number): string {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

/** Abrevia nomes longos nos PDFs (ex.: "Bruno Vendedor" → "Bruno V."). */
export function shortName(name: string, max = 18): string {
  const t = name.trim();
  if (!t) return "—";
  if (t.length <= max) return t;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]!;
    const lastInit = parts[parts.length - 1]!.charAt(0).toUpperCase();
    const compact = `${first} ${lastInit}.`;
    if (compact.length <= max) return compact;
    return `${first.slice(0, Math.max(1, max - 3))}…`;
  }
  return `${t.slice(0, max - 1)}…`;
}

export function shortDateTime(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function orderCode(order: {
  id: string;
  orderNumber?: number | null;
}): string {
  if (order.orderNumber != null) return String(order.orderNumber);
  return "—";
}

/** Slug para nome de arquivo (evita "—" no disco). */
export function orderCodeFileSlug(order: {
  id: string;
  orderNumber?: number | null;
}): string {
  if (order.orderNumber != null) return String(order.orderNumber);
  return order.id;
}

export function lineDiscount(params: {
  unitPrice: unknown;
  basePrice?: unknown | null;
}): number {
  // TODO futuro: usar OrderItem.lineDiscount quando existir no schema.
  const unit = decToNum(params.unitPrice);
  if (params.basePrice == null) return 0;
  const base = decToNum(params.basePrice);
  const d = base - unit;
  return d > 0 ? d : 0;
}

export async function withPdfDoc(
  build: (doc: PDFKit.PDFDocument) => void | Promise<void>,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 24, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  await build(doc);
  doc.end();
  return done;
}

export function drawHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  orgName?: string,
  meta?: string,
) {
  const top = doc.y;
  doc.rect(PAGE.left, top, PAGE.width, 36).fill(COLORS.headerBg);
  doc
    .fillColor(COLORS.headerFg)
    .fontSize(14)
    .font("Helvetica-Bold")
    .text(title, PAGE.left + 12, top + 10, {
      width: PAGE.width - 24,
      align: "left",
    });
  doc.y = top + 44;

  if (orgName) {
    doc
      .fillColor(COLORS.muted)
      .fontSize(9)
      .font("Helvetica")
      .text(orgName, PAGE.left, doc.y, { width: PAGE.width / 2 });
  }
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font("Helvetica")
    .text(
      meta ?? `Gerado em ${new Date().toLocaleString("pt-BR")}`,
      PAGE.left,
      orgName ? doc.y - 11 : doc.y,
      { width: PAGE.width, align: "right" },
    );
  doc.moveDown(1.2);
  doc.fillColor(COLORS.text).font("Helvetica");
}

export function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
    return true;
  }
  return false;
}

export type PdfCol = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right" | "center";
};

export type PdfTable = {
  columns: PdfCol[];
  /** altura da linha de dados */
  rowHeight?: number;
  headerHeight?: number;
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

export function drawTableHeader(doc: PDFKit.PDFDocument, table: PdfTable) {
  const h = table.headerHeight ?? 22;
  ensureSpace(doc, h + 4);
  const y = doc.y;
  const xs = colXs(table.columns);

  doc.rect(PAGE.left, y, PAGE.width, h).fill(COLORS.headerBg);

  doc.fillColor(COLORS.headerFg).fontSize(8).font("Helvetica-Bold");
  table.columns.forEach((col, i) => {
    const pad = 4;
    doc.text(col.label, xs[i]! + pad, y + 6, {
      width: col.width - pad * 2,
      align: col.align ?? "left",
      lineBreak: false,
    });
  });

  doc.y = y + h;
  doc.fillColor(COLORS.text).font("Helvetica");
}

export function drawTableRow(
  doc: PDFKit.PDFDocument,
  table: PdfTable,
  cells: Record<string, string>,
  opts?: {
    index?: number;
    onNewPage?: () => void;
    /** Linha de totais: fundo destacado e texto em negrito. */
    emphasize?: boolean;
  },
) {
  const h = table.rowHeight ?? 20;
  const xs = colXs(table.columns);

  if (ensureSpace(doc, h + 2)) {
    opts?.onNewPage?.();
    drawTableHeader(doc, table);
  }

  const y = doc.y;
  const idx = opts?.index ?? 0;
  const bg = opts?.emphasize
    ? "#e2e8f0"
    : idx % 2 === 0
      ? COLORS.rowEven
      : COLORS.rowOdd;

  doc.rect(PAGE.left, y, PAGE.width, h).fill(bg);
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.4)
    .moveTo(PAGE.left, y + h)
    .lineTo(PAGE.right, y + h)
    .stroke();

  doc
    .fillColor(COLORS.text)
    .fontSize(8)
    .font(opts?.emphasize ? "Helvetica-Bold" : "Helvetica");
  table.columns.forEach((col, i) => {
    const pad = 4;
    const text = cells[col.key] ?? "—";
    const align = col.align ?? "left";
    doc.text(text, xs[i]! + pad, y + 5, {
      width: col.width - pad * 2,
      align,
      lineBreak: false,
      // Valores numéricos à direita: não cortar com reticências.
      ellipsis: align !== "right",
      height: h - 6,
    });
  });

  doc.y = y + h;
  if (opts?.emphasize) doc.font("Helvetica");
}

export function drawTableFooter(
  doc: PDFKit.PDFDocument,
  leftLabel: string,
  rightLabel: string,
) {
  ensureSpace(doc, 28);
  doc.moveDown(0.4);
  const y = doc.y;
  doc.rect(PAGE.left, y, PAGE.width, 24).fill("#e2e8f0");
  doc
    .fillColor(COLORS.text)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text(leftLabel, PAGE.left + 8, y + 7, {
      width: PAGE.width / 2 - 12,
    });
  doc.text(rightLabel, PAGE.left + PAGE.width / 2, y + 7, {
    width: PAGE.width / 2 - 8,
    align: "right",
  });
  doc.y = y + 28;
  doc.font("Helvetica").fillColor(COLORS.text);
}

export function drawInfoBar(
  doc: PDFKit.PDFDocument,
  lines: Array<{ label: string; value: string }>,
) {
  ensureSpace(doc, 18 * lines.length + 12);
  const startY = doc.y;
  const boxH = 8 + lines.length * 14;
  doc
    .roundedRect(PAGE.left, startY, PAGE.width, boxH, 3)
    .fillAndStroke("#f8fafc", COLORS.border);

  let y = startY + 6;
  for (const line of lines) {
    doc
      .fillColor(COLORS.muted)
      .fontSize(8)
      .font("Helvetica")
      .text(line.label, PAGE.left + 10, y, {
        continued: true,
        lineBreak: false,
      });
    doc
      .fillColor(COLORS.text)
      .font("Helvetica-Bold")
      .text(` ${line.value}`, { lineBreak: false });
    y += 14;
  }
  doc.y = startY + boxH + 10;
  doc.font("Helvetica").fillColor(COLORS.text);
}

export function drawEmptyState(doc: PDFKit.PDFDocument, message: string) {
  ensureSpace(doc, 40);
  doc
    .roundedRect(PAGE.left, doc.y, PAGE.width, 36, 3)
    .fillAndStroke("#f8fafc", COLORS.border);
  doc
    .fillColor(COLORS.muted)
    .fontSize(10)
    .text(message, PAGE.left + 12, doc.y + 12, {
      width: PAGE.width - 24,
      align: "center",
    });
  doc.moveDown(2);
  doc.fillColor(COLORS.text);
}
