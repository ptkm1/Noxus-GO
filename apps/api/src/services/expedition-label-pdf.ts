import {
  APP_BRAND_NAME,
  formatCepMask,
  formatStructuredAddress,
} from "@pedidos/shared";
import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { prisma } from "../db.js";
import { resolveOrderPdfLogo } from "./order-pdf-logo.js";
import { orderCode } from "./reports/pdf-common.js";

const MM = 72 / 25.4;

export type ExpeditionLabelSize = {
  widthMm: number;
  heightMm: number;
};

export const DEFAULT_LABEL_SIZE: ExpeditionLabelSize = {
  widthMm: 100,
  heightMm: 150,
};

export function parseLabelSize(
  widthMm?: number,
  heightMm?: number,
): ExpeditionLabelSize {
  const w =
    widthMm && widthMm >= 40 && widthMm <= 120
      ? widthMm
      : DEFAULT_LABEL_SIZE.widthMm;
  const h =
    heightMm && heightMm >= 60 && heightMm <= 200
      ? heightMm
      : DEFAULT_LABEL_SIZE.heightMm;
  return { widthMm: w, heightMm: h };
}

async function code128Png(text: string): Promise<Buffer | null> {
  try {
    return await bwipjs.toBuffer({
      bcid: "code128",
      text,
      scale: 2,
      height: 12,
      includetext: false,
    });
  } catch {
    return null;
  }
}

export async function buildExpeditionLabelPdf(params: {
  organizationId: string;
  orderId: string;
  volumeIndex: number;
  size?: ExpeditionLabelSize;
}): Promise<Buffer> {
  const size = params.size ?? DEFAULT_LABEL_SIZE;
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    include: {
      customer: true,
      organization: {
        select: { name: true, displayName: true, logoUrl: true },
      },
      expedition: true,
    },
  });
  if (!order) {
    throw Object.assign(new Error("Pedido não encontrado"), {
      statusCode: 404,
    });
  }
  const volumeTotal = Math.max(1, order.expedition?.volumeQty ?? 1);
  const volumeIndex = Math.min(Math.max(1, params.volumeIndex), volumeTotal);
  const code = orderCode(order);
  const orgName =
    order.organization.displayName?.trim() || order.organization.name;
  const c = order.customer;
  const logo = await resolveOrderPdfLogo({
    organizationId: params.organizationId,
    logoUrl: order.organization.logoUrl,
  });

  const pageW = size.widthMm * MM;
  const pageH = size.heightMm * MM;
  const margin = 8;
  const contentW = pageW - margin * 2;

  const barcodeText = code !== "—" ? code : order.id.slice(0, 12);
  const [barcodePng, qrPng] = await Promise.all([
    code128Png(barcodeText),
    QRCode.toBuffer(`PEDIDO:${order.id}`, { margin: 0, width: 128 }).catch(
      () => null as Buffer | null,
    ),
  ]);

  const doc = new PDFDocument({
    size: [pageW, pageH],
    margin,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  if (logo) {
    try {
      doc.image(logo.buffer, margin, margin, {
        fit: [contentW, 28],
        align: "center",
      });
      doc.y = margin + 32;
    } catch {
      doc.y = margin;
    }
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(orgName, margin, doc.y, { width: contentW, align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(8).text("ETIQUETA DE EXPEDIÇÃO", margin, doc.y, {
    width: contentW,
    align: "center",
  });
  doc.moveDown(0.4);
  doc.fontSize(16).text(`PEDIDO Nº ${code}`, margin, doc.y, {
    width: contentW,
    align: "center",
  });
  doc.moveDown(0.35);

  const name =
    c?.tradeName?.trim() || c?.legalName?.trim() || c?.name?.trim() || "—";
  doc.font("Helvetica-Bold").fontSize(8).text("CLIENTE", margin, doc.y, {
    width: contentW,
  });
  doc.font("Helvetica").fontSize(10).text(name, { width: contentW });
  const cityUf = [c?.city?.trim(), c?.state?.trim()].filter(Boolean).join("/");
  if (cityUf) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("CIDADE/UF", { width: contentW });
    doc.font("Helvetica").fontSize(10).text(cityUf, { width: contentW });
  }
  const street = [c?.street?.trim(), c?.number?.trim()]
    .filter(Boolean)
    .join(", ");
  if (street) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("ENDEREÇO", { width: contentW });
    doc.font("Helvetica").fontSize(9).text(street, { width: contentW });
  }
  if (c?.neighborhood?.trim()) {
    doc.font("Helvetica-Bold").fontSize(8).text("BAIRRO", { width: contentW });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(c.neighborhood.trim(), { width: contentW });
  }
  if (c?.cep?.trim()) {
    doc.font("Helvetica-Bold").fontSize(8).text("CEP", { width: contentW });
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(formatCepMask(c.cep), { width: contentW });
  }
  const full = c ? formatStructuredAddress(c) : null;
  if (full && !street) {
    doc.font("Helvetica").fontSize(8).text(full, { width: contentW });
  }

  doc.moveDown(0.4);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(`VOLUMES: ${volumeIndex}/${volumeTotal}`, margin, doc.y, {
      width: contentW,
      align: "center",
    });

  const yBar = doc.y + 8;
  if (barcodePng) {
    doc.image(barcodePng, margin, yBar, { width: contentW * 0.62, height: 36 });
  }
  if (qrPng) {
    doc.image(qrPng, margin + contentW * 0.68, yBar, { width: 42, height: 42 });
  }
  doc.y = yBar + 46;
  doc
    .font("Helvetica")
    .fontSize(7)
    .text(barcodeText, margin, doc.y, {
      width: contentW * 0.62,
      align: "center",
    });
  doc
    .fontSize(6)
    .fillColor("#64748b")
    .text(APP_BRAND_NAME, margin, pageH - margin - 10, {
      width: contentW,
      align: "center",
    });

  doc.end();
  return done;
}
