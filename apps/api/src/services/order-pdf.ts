import {
  APP_BRAND_PRIMARY,
  formatCnpjMask,
  formatCpfMask,
  formatStructuredAddress,
} from "@pedidos/shared";
import { decToNum } from "../util/money.js";
import type { OrderPdfLogo } from "./order-pdf-logo.js";
import {
  COLORS,
  PAGE,
  money,
  orderCode,
  orderCodeFileSlug,
  shortDateTime,
  withPdfDoc,
} from "./reports/pdf-common.js";

export type OrderPdfCustomer = {
  name: string;
  email?: string | null;
  phone?: string | null;
  legalName?: string | null;
  tradeName?: string | null;
  documentType?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  addressNote?: string | null;
};

/** Dados do emitente (Organization / white-label). */
export type OrderPdfOrganization = {
  name: string;
  cnpj?: string | null;
  stateRegistration?: string | null;
  address?: string | null;
  complement?: string | null;
};

export type OrderPdfPaymentCondition = {
  name: string;
  days: number;
  label: string;
};

export type OrderPdfInput = {
  id: string;
  orderNumber?: number | null;
  totalAmount: unknown;
  comboDiscountTotal?: unknown;
  notes: string | null;
  createdAt: Date;
  /** @deprecated prefer `organization.name` */
  organizationName: string;
  organization: OrderPdfOrganization;
  paymentCondition?: OrderPdfPaymentCondition | null;
  logo?: OrderPdfLogo | null;
  seller: { user: { name: string; email?: string | null } };
  customer: OrderPdfCustomer | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: unknown;
    product?: { sku: string | null } | null;
  }>;
};

export function orderPdfFilename(order: {
  id: string;
  orderNumber?: number | null;
}): string {
  return `pedido-${orderCodeFileSlug(order)}.pdf`;
}

const COLS = {
  product: { x: PAGE.left, w: 248 },
  sku: { x: PAGE.left + 248, w: 72 },
  qty: { x: PAGE.left + 320, w: 48 },
  unit: { x: PAGE.left + 368, w: 85 },
  sub: { x: PAGE.left + 453, w: 94 },
} as const;

const CONTENT_BOTTOM = 52;
const BRAND = APP_BRAND_PRIMARY;

function pageBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - CONTENT_BOTTOM;
}

function ensureSpace(
  doc: PDFKit.PDFDocument,
  needed: number,
  redrawHeader?: () => void,
) {
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

function drawSectionLabel(
  doc: PDFKit.PDFDocument,
  label: string,
  x: number,
  y: number,
) {
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font("Helvetica-Bold")
    .text(label.toUpperCase(), x, y, {
      lineBreak: false,
      characterSpacing: 0.5,
    });
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
    .text(value, x, y + 12, { width, lineBreak: false, ellipsis: true });
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
  doc.font("Helvetica-Bold").text(money(sub), COLS.sub.x + pad, textY, {
    width: COLS.sub.w - pad * 2,
    align: "right",
    lineBreak: false,
  });

  doc.y = y + rowH;
  doc.font("Helvetica").fillColor(COLORS.text);
}

function customerDocumentLine(c: OrderPdfCustomer): string | null {
  const cnpj = c.cnpj?.replace(/\D/g, "") ?? "";
  const cpf = c.cpf?.replace(/\D/g, "") ?? "";
  const parts: string[] = [];
  if (cnpj) parts.push(`CNPJ ${formatCnpjMask(cnpj)}`);
  if (cpf) parts.push(`CPF ${formatCpfMask(cpf)}`);
  if (parts.length === 0 && c.documentType === "CNPJ" && c.cnpj?.trim()) {
    parts.push(`CNPJ ${c.cnpj.trim()}`);
  }
  if (parts.length === 0 && c.documentType === "CPF" && c.cpf?.trim()) {
    parts.push(`CPF ${c.cpf.trim()}`);
  }
  return parts.length > 0 ? parts.join("  ·  ") : null;
}

function customerPrimaryName(c: OrderPdfCustomer): string {
  return c.legalName?.trim() || c.tradeName?.trim() || c.name.trim() || "—";
}

function buildCustomerDetailLines(c: OrderPdfCustomer): Array<{
  label?: string;
  text: string;
  primary?: boolean;
}> {
  const lines: Array<{ label?: string; text: string; primary?: boolean }> = [];
  const primary = customerPrimaryName(c);
  lines.push({ text: primary, primary: true });

  const trade = c.tradeName?.trim();
  if (trade && trade !== primary) {
    lines.push({ label: "Nome fantasia", text: trade });
  }

  const legal = c.legalName?.trim();
  if (legal && legal !== primary && legal !== trade) {
    lines.push({ label: "Razão social", text: legal });
  }

  const cadastro = c.name.trim();
  if (
    cadastro &&
    cadastro !== primary &&
    cadastro !== trade &&
    cadastro !== legal
  ) {
    lines.push({ label: "Nome", text: cadastro });
  }

  const docLine = customerDocumentLine(c);
  if (docLine) lines.push({ text: docLine });

  const structured = formatStructuredAddress(c);
  if (structured) lines.push({ label: "Endereço", text: structured });
  const note = c.addressNote?.trim();
  if (note && note !== structured) {
    lines.push({
      label: structured ? "Complemento" : "Endereço",
      text: note,
    });
  }

  const comm: string[] = [];
  if (c.phone?.trim()) comm.push(c.phone.trim());
  if (c.email?.trim()) comm.push(c.email.trim());
  if (comm.length) lines.push({ label: "Contato", text: comm.join("  ·  ") });

  return lines;
}

function drawInfoCard(
  doc: PDFKit.PDFDocument,
  label: string,
  lines: Array<{ label?: string; text: string; primary?: boolean }>,
) {
  const padX = 12;
  const padY = 10;
  const innerW = PAGE.width - padX * 2;

  doc.fontSize(11).font("Helvetica-Bold");
  let contentH = 18;
  for (const line of lines) {
    const size = line.primary ? 11 : 9;
    const font = line.primary ? "Helvetica-Bold" : "Helvetica";
    doc.font(font).fontSize(size);
    const prefix = line.label ? `${line.label}: ` : "";
    const h = doc.heightOfString(prefix + line.text, { width: innerW });
    contentH += Math.max(line.primary ? 16 : 13, h + 2);
  }
  contentH += padY;

  ensureSpace(doc, contentH + 8);
  const top = doc.y;
  doc
    .roundedRect(PAGE.left, top, PAGE.width, contentH, 5)
    .fillAndStroke("#f8fafc", COLORS.border);
  doc.rect(PAGE.left, top, 3, contentH).fill(BRAND);

  drawSectionLabel(doc, label, PAGE.left + padX, top + padY);
  let ty = top + padY + 16;

  for (const line of lines) {
    const size = line.primary ? 11 : 9;
    const font = line.primary ? "Helvetica-Bold" : "Helvetica";
    const full = line.label ? `${line.label}: ${line.text}` : line.text;
    doc.font(font).fontSize(size);
    const h = Math.max(
      line.primary ? 14 : 12,
      doc.heightOfString(full, { width: innerW }),
    );
    doc
      .fillColor(COLORS.text)
      .font(font)
      .fontSize(size)
      .text(full, PAGE.left + padX, ty, { width: innerW });
    ty += h + 2;
  }

  doc.y = top + contentH + 14;
  doc.font("Helvetica").fillColor(COLORS.text);
}

function drawCustomerBlock(
  doc: PDFKit.PDFDocument,
  customer: OrderPdfCustomer | null,
) {
  const lines = customer
    ? buildCustomerDetailLines(customer)
    : [{ text: "Sem cliente vinculado", primary: true as const }];
  drawInfoCard(doc, "Cliente", lines);
}

function drawHeaderLogo(
  doc: PDFKit.PDFDocument,
  logo: OrderPdfLogo | null | undefined,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
): number {
  if (!logo) return 0;
  try {
    doc.image(logo.buffer, x, y, {
      fit: [boxW, boxH],
      align: "center",
      valign: "center",
    });
    return boxW + 10;
  } catch {
    return 0;
  }
}

function orgDisplayName(order: OrderPdfInput): string {
  return order.organization?.name?.trim() || order.organizationName || "—";
}

export async function buildOrderPdf(order: OrderPdfInput): Promise<Buffer> {
  return withPdfDoc((doc) => {
    drawOrderPdfContents(doc, order);
  });
}

export function drawOrderPdfContents(
  doc: PDFKit.PDFDocument,
  order: OrderPdfInput,
) {
  const code = orderCode(order);
  const total = decToNum(order.totalAmount);
  const comboDiscount = decToNum(order.comboDiscountTotal ?? 0);
  const itemsSubtotal = order.items.reduce(
    (sum, it) => sum + decToNum(it.unitPrice) * it.quantity,
    0,
  );
  const generatedAt = new Date().toLocaleString("pt-BR");
  const codeLabel = code.startsWith("#") ? code : `#${code}`;
  const orgName = orgDisplayName(order);
  const org = order.organization ?? { name: orgName };
  const payLabel = order.paymentCondition?.label?.trim() || null;
  const showDiscount = comboDiscount > 0;
  const showSubtotal = showDiscount || Math.abs(itemsSubtotal - total) > 0.009;

  const hasExtraOrg =
    Boolean(org.cnpj) ||
    Boolean(org.stateRegistration) ||
    Boolean(org.address) ||
    Boolean(org.complement);

  const headerH = hasExtraOrg ? 78 : 62;
  const headerY = 24;
  doc
    .roundedRect(PAGE.left, headerY, PAGE.width, headerH, 5)
    .fillAndStroke("#f8fafc", COLORS.border);
  doc.rect(PAGE.left, headerY, 4, headerH).fill(BRAND);

  const logoBox = { w: 48, h: 40 };
  const logoX = PAGE.left + 14;
  const logoY = headerY + 11;
  const textOffset = drawHeaderLogo(
    doc,
    order.logo,
    logoX,
    logoY,
    logoBox.w,
    logoBox.h,
  );
  const textX = logoX + (textOffset || 0);
  const textW = PAGE.width - (textX - PAGE.left) - 130;

  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("EMITENTE", textX, headerY + 8, {
      width: Math.max(80, textW),
      lineBreak: false,
      characterSpacing: 0.4,
    });
  doc
    .fillColor(COLORS.text)
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(orgName, textX, headerY + 20, {
      width: Math.max(80, textW),
      lineBreak: false,
      ellipsis: true,
    });

  let detailY = headerY + 38;
  doc.fillColor(COLORS.muted).fontSize(8).font("Helvetica");
  const detailParts: string[] = [];
  if (org.cnpj) detailParts.push(`CNPJ ${org.cnpj}`);
  if (org.stateRegistration) detailParts.push(`I.E. ${org.stateRegistration}`);
  if (detailParts.length) {
    doc.text(detailParts.join("  ·  "), textX, detailY, {
      width: Math.max(80, textW),
      lineBreak: false,
      ellipsis: true,
    });
    detailY += 12;
  }
  if (org.address) {
    const addr =
      org.complement && !org.address.includes(org.complement)
        ? `${org.address} · ${org.complement}`
        : org.address;
    doc.text(addr, textX, detailY, {
      width: Math.max(80, textW),
      lineBreak: false,
      ellipsis: true,
    });
  }

  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font("Helvetica")
    .text("Pedido Nº", PAGE.right - 120, headerY + 12, {
      width: 106,
      align: "right",
      lineBreak: false,
    });
  doc
    .fillColor(COLORS.text)
    .fontSize(18)
    .font("Helvetica-Bold")
    .text(codeLabel, PAGE.right - 120, headerY + 26, {
      width: 106,
      align: "right",
      lineBreak: false,
    });
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font("Helvetica")
    .text(shortDateTime(order.createdAt), PAGE.right - 120, headerY + 48, {
      width: 106,
      align: "right",
      lineBreak: false,
    });

  doc.y = headerY + headerH + 14;

  const metaY = doc.y;
  const colGap = 12;
  const colCount = payLabel ? 2 : 1;
  const colW = (PAGE.width - colGap * (colCount - 1)) / colCount;

  const sellerValue = order.seller.user.email?.trim()
    ? `${order.seller.user.name}  ·  ${order.seller.user.email.trim()}`
    : order.seller.user.name;
  drawMetaPair(doc, "Vendedor", sellerValue, PAGE.left, metaY, colW);

  if (payLabel) {
    drawMetaPair(
      doc,
      "Condição de pagamento",
      payLabel,
      PAGE.left + colW + colGap,
      metaY,
      colW,
    );
  }
  doc.y = metaY + 34;

  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.6)
    .moveTo(PAGE.left, doc.y)
    .lineTo(PAGE.right, doc.y)
    .stroke();
  doc.moveDown(0.7);

  drawCustomerBlock(doc, order.customer);

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

  const totalsBlockH =
    28 + (showSubtotal ? 14 : 0) + (showDiscount ? 14 : 0) + 8;
  ensureSpace(doc, Math.max(88, totalsBlockH + 24));
  doc.moveDown(0.6);
  const totalsW = 240;
  const totalsX = PAGE.right - totalsW;
  let ty = doc.y;

  const summaryX = PAGE.left;
  const summaryW = Math.max(120, totalsX - PAGE.left - 16);
  doc
    .fillColor(COLORS.muted)
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("RESUMO", summaryX, ty, { width: summaryW, lineBreak: false });
  let sy = ty + 14;
  doc
    .fillColor(COLORS.text)
    .fontSize(9)
    .font("Helvetica")
    .text(`Itens: ${order.items.length}`, summaryX, sy, {
      width: summaryW,
      lineBreak: false,
    });
  sy += 13;
  if (payLabel) {
    doc.text(`Pagamento: ${payLabel}`, summaryX, sy, {
      width: summaryW,
      lineBreak: false,
    });
    sy += 13;
  }
  if (order.paymentCondition && order.paymentCondition.days > 0) {
    doc
      .fillColor(COLORS.muted)
      .fontSize(8)
      .text(`Prazo: ${order.paymentCondition.days} dias`, summaryX, sy, {
        width: summaryW,
        lineBreak: false,
      });
    sy += 13;
  }

  const drawTotalLine = (
    label: string,
    value: string,
    opts?: { bold?: boolean; muted?: boolean; large?: boolean },
  ) => {
    doc
      .fillColor(opts?.muted ? COLORS.muted : COLORS.text)
      .fontSize(opts?.large ? 12 : 9)
      .font(opts?.bold || opts?.large ? "Helvetica-Bold" : "Helvetica")
      .text(label, totalsX, ty, { width: 120, lineBreak: false });
    doc.text(value, totalsX + 120, ty, {
      width: 120,
      align: "right",
      lineBreak: false,
    });
    ty += opts?.large ? 18 : 14;
  };

  if (showSubtotal) {
    drawTotalLine("Subtotal itens", money(itemsSubtotal));
  }
  if (showDiscount) {
    drawTotalLine("Descontos", `− ${money(comboDiscount)}`, { muted: true });
    ty += 2;
  }

  doc.roundedRect(totalsX - 8, ty - 4, totalsW + 8, 28, 4).fill("#e2e8f0");
  doc
    .fillColor(COLORS.text)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Total", totalsX, ty + 5, { width: 120, lineBreak: false });
  doc.text(money(total), totalsX + 120, ty + 5, {
    width: 120,
    align: "right",
    lineBreak: false,
  });
  doc.y = Math.max(sy + 8, ty + 36);
  doc.font("Helvetica").fillColor(COLORS.text);

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
  doc.text(orgName, PAGE.left, footerY + 8, {
    width: PAGE.width,
    align: "right",
    lineBreak: false,
    ellipsis: true,
  });
}
