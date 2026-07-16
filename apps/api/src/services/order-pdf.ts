import { decToNum } from "../util/money.js";
import {
  COLORS,
  PAGE,
  money,
  orderCode,
  shortDateTime,
  withPdfDoc,
} from "./reports/pdf-common.js";

const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  PENDING_CREDIT_APPROVAL: "Aguardando crédito",
};

export type OrderPdfInput = {
  id: string;
  orderNumber?: number | null;
  status: string;
  totalAmount: unknown;
  comboDiscountTotal?: unknown;
  notes: string | null;
  createdAt: Date;
  organizationName: string;
  seller: { user: { name: string; email?: string | null } };
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: unknown;
    product?: { sku: string | null } | null;
  }>;
};

function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function orderPdfFilename(order: {
  id: string;
  orderNumber?: number | null;
}): string {
  const code = orderCode(order).replace("#", "");
  return `pedido-${code}.pdf`;
}

const COLS = {
  product: { x: PAGE.left, w: 248 },
  sku: { x: PAGE.left + 248, w: 72 },
  qty: { x: PAGE.left + 320, w: 48 },
  unit: { x: PAGE.left + 368, w: 85 },
  sub: { x: PAGE.left + 453, w: 94 },
} as const;

const CONTENT_BOTTOM = 52;

function pageBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - CONTENT_BOTTOM;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, redrawHeader?: () => void) {
  if (doc.y + needed <= pageBottom(doc)) return;
  doc.addPage();
  redrawHeader?.();
}

function drawBand(
  doc: PDFKit.PDFDocument,
  y: number,
  h: number,
  fill: string,
) {
  doc.rect(PAGE.left, y, PAGE.width, h).fill(fill);
}

function drawSectionLabel(doc: PDFKit.PDFDocument, label: string, x: number, y: number) {
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font("Helvetica-Bold")
    .text(label.toUpperCase(), x, y, { lineBreak: false, characterSpacing: 0.4 });
}

function drawMetaPair(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font("Helvetica")
    .text(label, x, y, { width, lineBreak: false });
  doc
    .fillColor(COLORS.text)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(value, x, y + 12, { width, lineBreak: false });
}

function drawItemsTableHeader(doc: PDFKit.PDFDocument) {
  ensureSpace(doc, 28);
  const y = doc.y;
  const h = 22;
  drawBand(doc, y, h, COLORS.headerBg);
  doc.fillColor(COLORS.headerFg).fontSize(8).font("Helvetica-Bold");

  const pad = 6;
  doc.text("Produto", COLS.product.x + pad, y + 7, {
    width: COLS.product.w - pad * 2,
    lineBreak: false,
  });
  doc.text("SKU", COLS.sku.x + pad, y + 7, {
    width: COLS.sku.w - pad * 2,
    lineBreak: false,
  });
  doc.text("Qtd", COLS.qty.x + pad, y + 7, {
    width: COLS.qty.w - pad * 2,
    align: "right",
    lineBreak: false,
  });
  doc.text("Preço unit.", COLS.unit.x + pad, y + 7, {
    width: COLS.unit.w - pad * 2,
    align: "right",
    lineBreak: false,
  });
  doc.text("Subtotal", COLS.sub.x + pad, y + 7, {
    width: COLS.sub.w - pad * 2,
    align: "right",
    lineBreak: false,
  });

  doc.y = y + h;
  doc.fillColor(COLORS.text).font("Helvetica");
}

function drawItemRow(
  doc: PDFKit.PDFDocument,
  item: OrderPdfInput["items"][number],
  index: number,
) {
  const unit = decToNum(item.unitPrice);
  const sub = unit * item.quantity;
  const sku = item.product?.sku?.trim() || "—";
  const name = item.productName.trim() || "—";
  const pad = 6;

  doc.fontSize(9).font("Helvetica");
  const nameH = Math.max(
    14,
    doc.heightOfString(name, { width: COLS.product.w - pad * 2 }),
  );
  const rowH = Math.max(22, nameH + 10);

  ensureSpace(doc, rowH + 2, () => drawItemsTableHeader(doc));

  const y = doc.y;
  const bg = index % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd;
  drawBand(doc, y, rowH, bg);
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.4)
    .moveTo(PAGE.left, y + rowH)
    .lineTo(PAGE.right, y + rowH)
    .stroke();

  const textY = y + 6;
  doc.fillColor(COLORS.text).fontSize(9).font("Helvetica");
  doc.text(name, COLS.product.x + pad, textY, {
    width: COLS.product.w - pad * 2,
  });
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .text(sku, COLS.sku.x + pad, textY, {
      width: COLS.sku.w - pad * 2,
      lineBreak: false,
      ellipsis: true,
      height: rowH - 8,
    });
  doc
    .fillColor(COLORS.text)
    .fontSize(9)
    .text(String(item.quantity), COLS.qty.x + pad, textY, {
      width: COLS.qty.w - pad * 2,
      align: "right",
      lineBreak: false,
    });
  doc.text(money(unit), COLS.unit.x + pad, textY, {
    width: COLS.unit.w - pad * 2,
    align: "right",
    lineBreak: false,
  });
  doc
    .font("Helvetica-Bold")
    .text(money(sub), COLS.sub.x + pad, textY, {
      width: COLS.sub.w - pad * 2,
      align: "right",
      lineBreak: false,
    });

  doc.y = y + rowH;
  doc.font("Helvetica").fillColor(COLORS.text);
}

function drawInfoCard(
  doc: PDFKit.PDFDocument,
  title: string,
  lines: string[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc
    .roundedRect(x, y, width, height, 4)
    .fillAndStroke("#f8fafc", COLORS.border);

  drawSectionLabel(doc, title, x + 10, y + 10);
  let ty = y + 26;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isPrimary = i === 0;
    doc
      .fillColor(COLORS.text)
      .fontSize(isPrimary ? 11 : 9)
      .font(isPrimary ? "Helvetica-Bold" : "Helvetica")
      .text(line, x + 10, ty, {
        width: width - 20,
        lineBreak: false,
        ellipsis: true,
      });
    ty += isPrimary ? 16 : 13;
  }
}

export async function buildOrderPdf(order: OrderPdfInput): Promise<Buffer> {
  return withPdfDoc((doc) => {
    const code = orderCode(order);
    const total = decToNum(order.totalAmount);
    const comboDiscount = decToNum(order.comboDiscountTotal ?? 0);
    const itemsSubtotal = order.items.reduce(
      (sum, it) => sum + decToNum(it.unitPrice) * it.quantity,
      0,
    );
    const generatedAt = new Date().toLocaleString("pt-BR");

    // ——— Cabeçalho ———
    const headerH = 56;
    const headerY = 24;
    doc.rect(PAGE.left, headerY, PAGE.width, headerH).fill(COLORS.headerBg);

    doc
      .fillColor(COLORS.headerFg)
      .fontSize(11)
      .font("Helvetica")
      .text(order.organizationName, PAGE.left + 14, headerY + 12, {
        width: PAGE.width - 28,
        lineBreak: false,
        ellipsis: true,
      });
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("Pedido", PAGE.left + 14, headerY + 28, {
        width: PAGE.width / 2,
        lineBreak: false,
      });
    doc
      .fontSize(14)
      .text(code.startsWith("#") ? code : `#${code}`, PAGE.left + 14, headerY + 28, {
        width: PAGE.width - 28,
        align: "right",
        lineBreak: false,
      });

    doc.y = headerY + headerH + 16;

    // ——— Meta: data / status ———
    const metaY = doc.y;
    const half = (PAGE.width - 12) / 2;
    drawMetaPair(
      doc,
      "Data",
      shortDateTime(order.createdAt),
      PAGE.left,
      metaY,
      half,
    );
    drawMetaPair(
      doc,
      "Status",
      statusLabel(order.status),
      PAGE.left + half + 12,
      metaY,
      half,
    );
    doc.y = metaY + 36;

    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.6)
      .moveTo(PAGE.left, doc.y)
      .lineTo(PAGE.right, doc.y)
      .stroke();
    doc.moveDown(0.8);

    // ——— Cliente / Vendedor ———
    const cardY = doc.y;
    const cardGap = 12;
    const cardW = (PAGE.width - cardGap) / 2;
    const cardH = 78;

    const customerLines = order.customer
      ? [
          order.customer.name,
          order.customer.email?.trim() || "",
          order.customer.phone?.trim() || "",
        ].filter(Boolean)
      : ["Sem cliente vinculado"];

    const sellerLines = [
      order.seller.user.name,
      order.seller.user.email?.trim() || "",
    ].filter(Boolean);

    drawInfoCard(doc, "Cliente", customerLines, PAGE.left, cardY, cardW, cardH);
    drawInfoCard(
      doc,
      "Vendedor",
      sellerLines,
      PAGE.left + cardW + cardGap,
      cardY,
      cardW,
      cardH,
    );
    doc.y = cardY + cardH + 18;

    // ——— Itens ———
    drawSectionLabel(doc, "Itens do pedido", PAGE.left, doc.y);
    doc.y += 14;
    drawItemsTableHeader(doc);

    if (order.items.length === 0) {
      ensureSpace(doc, 36);
      const emptyY = doc.y;
      drawBand(doc, emptyY, 32, "#f8fafc");
      doc
        .fillColor(COLORS.muted)
        .fontSize(9)
        .font("Helvetica")
        .text("Nenhum item neste pedido.", PAGE.left + 8, emptyY + 10, {
          width: PAGE.width - 16,
          align: "center",
        });
      doc.y = emptyY + 36;
      doc.fillColor(COLORS.text);
    } else {
      order.items.forEach((item, i) => drawItemRow(doc, item, i));
    }

    // ——— Totais ———
    ensureSpace(doc, 88);
    doc.moveDown(0.6);
    const totalsW = 220;
    const totalsX = PAGE.right - totalsW;
    let ty = doc.y;

    const drawTotalLine = (
      label: string,
      value: string,
      opts?: { bold?: boolean; muted?: boolean; large?: boolean },
    ) => {
      doc
        .fillColor(opts?.muted ? COLORS.muted : COLORS.text)
        .fontSize(opts?.large ? 12 : 9)
        .font(opts?.bold || opts?.large ? "Helvetica-Bold" : "Helvetica")
        .text(label, totalsX, ty, { width: 110, lineBreak: false });
      doc.text(value, totalsX + 110, ty, {
        width: 110,
        align: "right",
        lineBreak: false,
      });
      ty += opts?.large ? 18 : 14;
    };

    if (comboDiscount > 0) {
      drawTotalLine("Subtotal itens", money(itemsSubtotal));
      drawTotalLine("Desconto combos", `− ${money(comboDiscount)}`, {
        muted: true,
      });
      ty += 2;
    }

    doc
      .roundedRect(totalsX - 8, ty - 4, totalsW + 8, 28, 4)
      .fill("#e2e8f0");
    doc
      .fillColor(COLORS.text)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Total", totalsX, ty + 5, { width: 110, lineBreak: false });
    doc.text(money(total), totalsX + 110, ty + 5, {
      width: 110,
      align: "right",
      lineBreak: false,
    });
    doc.y = ty + 36;
    doc.font("Helvetica").fillColor(COLORS.text);

    // ——— Observações ———
    if (order.notes?.trim()) {
      const notesText = order.notes.trim();
      doc.fontSize(9).font("Helvetica");
      const notesH = Math.max(
        36,
        doc.heightOfString(notesText, { width: PAGE.width - 20 }) + 16,
      );
      ensureSpace(doc, 14 + notesH + 10);
      doc.moveDown(0.4);
      drawSectionLabel(doc, "Observações", PAGE.left, doc.y);
      doc.y += 14;
      const notesTop = doc.y;
      doc
        .roundedRect(PAGE.left, notesTop, PAGE.width, notesH, 4)
        .fillAndStroke("#f8fafc", COLORS.border);
      doc
        .fillColor(COLORS.text)
        .fontSize(9)
        .font("Helvetica")
        .text(notesText, PAGE.left + 10, notesTop + 8, {
          width: PAGE.width - 20,
        });
      doc.y = notesTop + notesH + 10;
    }

    // ——— Rodapé ———
    const footerY = doc.page.height - 36;
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(PAGE.left, footerY)
      .lineTo(PAGE.right, footerY)
      .stroke();
    doc
      .fillColor(COLORS.muted)
      .fontSize(8)
      .font("Helvetica")
      .text(`Gerado em ${generatedAt}`, PAGE.left, footerY + 8, {
        width: PAGE.width / 2,
        lineBreak: false,
      });
    doc.text(order.organizationName, PAGE.left, footerY + 8, {
      width: PAGE.width,
      align: "right",
      lineBreak: false,
      ellipsis: true,
    });
  });
}
