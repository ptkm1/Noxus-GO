import PDFDocument from "pdfkit";
import { decToNum } from "../util/money.js";

const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  PENDING_CREDIT_APPROVAL: "Aguardando crédito",
};

export type OrderPdfInput = {
  id: string;
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

function money(n: number): string {
  return `R$ ${n.toFixed(2)}`;
}

function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function orderPdfFilename(orderId: string): string {
  return `pedido-${orderId.slice(0, 8)}.pdf`;
}

export async function buildOrderPdf(order: OrderPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const total = decToNum(order.totalAmount);
  const comboDiscount = decToNum(order.comboDiscountTotal ?? 0);
  const itemsSubtotal = order.items.reduce(
    (sum, it) => sum + decToNum(it.unitPrice) * it.quantity,
    0,
  );

  doc.fontSize(18).text(order.organizationName, { align: "center" });
  doc.fontSize(14).text("Pedido de venda", { align: "center" });
  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .fillColor("#555555")
    .text(`Pedido #${order.id.slice(0, 8).toUpperCase()}`, { align: "center" });
  doc.fillColor("#000000");
  doc.moveDown(1.5);

  doc.fontSize(11);
  doc.text(`Data: ${order.createdAt.toLocaleString("pt-BR")}`);
  doc.text(`Status: ${statusLabel(order.status)}`);
  doc.text(`Vendedor: ${order.seller.user.name}`);
  if (order.seller.user.email)
    doc.text(`E-mail vendedor: ${order.seller.user.email}`);
  doc.moveDown(0.5);

  doc.fontSize(12).text("Cliente", { underline: true });
  doc.fontSize(11);
  if (order.customer) {
    doc.text(`Nome: ${order.customer.name}`);
    if (order.customer.email) doc.text(`E-mail: ${order.customer.email}`);
    if (order.customer.phone) doc.text(`Telefone: ${order.customer.phone}`);
  } else {
    doc.text("Sem cliente vinculado");
  }
  doc.moveDown(1);

  const tableTop = doc.y;
  const colProduct = 50;
  const colQty = 320;
  const colUnit = 370;
  const colSub = 460;

  doc.fontSize(10).fillColor("#444444");
  doc.text("Produto", colProduct, tableTop);
  doc.text("Qtd", colQty, tableTop);
  doc.text("Unit.", colUnit, tableTop);
  doc.text("Subtotal", colSub, tableTop);
  doc.fillColor("#000000");

  let y = tableTop + 18;
  doc
    .moveTo(50, y - 4)
    .lineTo(545, y - 4)
    .strokeColor("#cccccc")
    .stroke();
  doc.strokeColor("#000000");

  for (const it of order.items) {
    const unit = decToNum(it.unitPrice);
    const sub = unit * it.quantity;
    const sku = it.product?.sku?.trim();
    const label = sku ? `${it.productName} (${sku})` : it.productName;

    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    doc.fontSize(10).text(label, colProduct, y, { width: 260 });
    doc.text(String(it.quantity), colQty, y);
    doc.text(money(unit), colUnit, y);
    doc.text(money(sub), colSub, y);
    y += doc.heightOfString(label, { width: 260 }) + 8;
  }

  doc.moveDown(2);
  const summaryY = Math.max(y + 10, doc.y);
  doc.y = summaryY;

  doc.fontSize(11);
  if (comboDiscount > 0) {
    doc.text(`Subtotal itens: ${money(itemsSubtotal)}`, { align: "right" });
    doc.text(`Desconto combos: − ${money(comboDiscount)}`, { align: "right" });
  }
  doc.fontSize(13).text(`Total: ${money(total)}`, { align: "right" });

  if (order.notes?.trim()) {
    doc.moveDown(1.5);
    doc.fontSize(11).text("Observações", { underline: true });
    doc.fontSize(10).text(order.notes.trim(), { width: 495 });
  }

  doc.moveDown(2);
  doc
    .fontSize(9)
    .fillColor("#888888")
    .text(`Documento gerado em ${new Date().toLocaleString("pt-BR")}`, {
      align: "center",
    });

  doc.end();
  return done;
}
