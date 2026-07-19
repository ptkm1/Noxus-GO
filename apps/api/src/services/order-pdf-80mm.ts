import PDFDocument from "pdfkit";
import { decToNum } from "../util/money.js";
import type { OrderPdfInput } from "./order-pdf.js";
import { money, orderCode, shortDateTime } from "./reports/pdf-common.js";

/** 80mm thermal roll ≈ 226.77pt wide. */
const MM = 72 / 25.4;
const PAGE_W = 80 * MM;
const MARGIN = 8;
const CONTENT_W = PAGE_W - MARGIN * 2;

const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  PENDING_CREDIT_APPROVAL: "Aguardando crédito",
};

function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

function hr(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc
    .strokeColor("#000000")
    .lineWidth(0.5)
    .moveTo(MARGIN, y)
    .lineTo(PAGE_W - MARGIN, y)
    .stroke();
  doc.moveDown(0.35);
}

function center(
  doc: PDFKit.PDFDocument,
  text: string,
  opts?: { size?: number; bold?: boolean },
) {
  doc
    .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts?.size ?? 9)
    .fillColor("#000000")
    .text(text, MARGIN, doc.y, {
      width: CONTENT_W,
      align: "center",
    });
}

function line(
  doc: PDFKit.PDFDocument,
  left: string,
  right: string,
  opts?: { bold?: boolean; size?: number },
) {
  const size = opts?.size ?? 8;
  const font = opts?.bold ? "Helvetica-Bold" : "Helvetica";
  const y = doc.y;
  doc.font(font).fontSize(size).fillColor("#000000");
  doc.text(left, MARGIN, y, { width: CONTENT_W * 0.55, lineBreak: false });
  doc.text(right, MARGIN + CONTENT_W * 0.45, y, {
    width: CONTENT_W * 0.55,
    align: "right",
    lineBreak: false,
  });
  doc.y = y + size + 4;
}

export function orderPdf80mmFilename(order: {
  id: string;
  orderNumber?: number | null;
}): string {
  const code = orderCode(order).replace("#", "");
  return `pedido-${code}-80mm.pdf`;
}

/**
 * Cupom térmico 80mm (largura fixa, altura estimada pelo conteúdo).
 */
export async function buildOrderPdf80mm(order: OrderPdfInput): Promise<Buffer> {
  const code = orderCode(order);
  const total = decToNum(order.totalAmount);
  const comboDiscount = decToNum(order.comboDiscountTotal ?? 0);
  const itemsSubtotal = order.items.reduce(
    (sum, it) => sum + decToNum(it.unitPrice) * it.quantity,
    0,
  );
  const generatedAt = new Date().toLocaleString("pt-BR");

  // Folga generosa: cupom térmico costuma ser uma página contínua.
  const estimatedH = Math.max(
    400,
    220 + order.items.length * 44 + (order.notes?.trim() ? 80 : 0),
  );

  const doc = new PDFDocument({
    size: [PAGE_W, estimatedH],
    margin: MARGIN,
    autoFirstPage: true,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.y = MARGIN;

  center(doc, order.organizationName, { size: 11, bold: true });
  center(doc, "PEDIDO", { size: 10, bold: true });
  center(doc, code.startsWith("#") ? code : `#${code}`, {
    size: 12,
    bold: true,
  });
  doc.moveDown(0.25);
  hr(doc);

  doc.font("Helvetica").fontSize(8).fillColor("#000000");
  doc.text(`Data: ${shortDateTime(order.createdAt)}`, MARGIN, doc.y, {
    width: CONTENT_W,
  });
  doc.text(`Status: ${statusLabel(order.status)}`, MARGIN, doc.y, {
    width: CONTENT_W,
  });
  doc.text(`Vendedor: ${order.seller.user.name}`, MARGIN, doc.y, {
    width: CONTENT_W,
  });
  doc.moveDown(0.2);
  hr(doc);

  doc.font("Helvetica-Bold").fontSize(8).text("CLIENTE", MARGIN, doc.y, {
    width: CONTENT_W,
  });
  doc
    .font("Helvetica")
    .fontSize(9)
    .text(order.customer?.name?.trim() || "Sem cliente vinculado", MARGIN, doc.y, {
      width: CONTENT_W,
    });
  if (order.customer?.phone?.trim()) {
    doc
      .fontSize(8)
      .text(order.customer.phone.trim(), MARGIN, doc.y, { width: CONTENT_W });
  }
  doc.moveDown(0.25);
  hr(doc);

  doc.font("Helvetica-Bold").fontSize(8).text("ITENS", MARGIN, doc.y, {
    width: CONTENT_W,
  });
  doc.moveDown(0.15);

  if (order.items.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .text("Nenhum item.", MARGIN, doc.y, { width: CONTENT_W });
  } else {
    for (const item of order.items) {
      const unit = decToNum(item.unitPrice);
      const sub = unit * item.quantity;
      const name = item.productName.trim() || "—";

      doc.font("Helvetica-Bold").fontSize(8).text(name, MARGIN, doc.y, {
        width: CONTENT_W,
      });
      line(doc, `${item.quantity} x ${money(unit)}`, money(sub), { size: 8 });
    }
  }

  doc.moveDown(0.15);
  hr(doc);

  if (comboDiscount > 0) {
    line(doc, "Subtotal", money(itemsSubtotal));
    line(doc, "Desconto combos", `− ${money(comboDiscount)}`);
  }
  line(doc, "TOTAL", money(total), { bold: true, size: 11 });

  if (order.notes?.trim()) {
    doc.moveDown(0.2);
    hr(doc);
    doc.font("Helvetica-Bold").fontSize(8).text("OBSERVAÇÕES", MARGIN, doc.y, {
      width: CONTENT_W,
    });
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(order.notes.trim(), MARGIN, doc.y, { width: CONTENT_W });
  }

  doc.moveDown(0.4);
  hr(doc);
  center(doc, `Gerado em ${generatedAt}`, { size: 7 });
  center(doc, "Obrigado!", { size: 8 });

  doc.end();
  return done;
}
