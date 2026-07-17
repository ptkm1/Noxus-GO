import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import { pdfKitLogoMime } from "../fiscal/danfe-logo.js";
import type { DanfeNfeData } from "../fiscal/nfe-xml-danfe.js";
import { formatAccessKeyDisplay } from "../fiscal/nfe-xml-danfe.js";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 10;
const W = PAGE_W - M * 2;
const GAP = 3;
const PAD = 4;
const CANHOTO_H = 72;
const FIELD_ROW_H = 22;
/** Largura da coluna da logo — altura = CANHOTO_H (mesma linha do canhoto). */
const LOGO_COL_W = 72;
const HDR_H = 108;

function fmtBrMoney(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBrDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("pt-BR");
}

function fmtBrDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleString("pt-BR");
}

function fmtDoc(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return doc;
}

function fmtNfNumber(n: number): string {
  return String(n).padStart(9, "0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
}

function advance(y: number, h: number): number {
  return y + h + GAP;
}

function lbl(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w?: number) {
  doc.font("Helvetica").fontSize(5.5).fillColor("#333").text(text, x + PAD, y + 2, {
    width: w ? w - PAD * 2 : undefined,
    lineBreak: false,
  });
  doc.fillColor("#000");
}

function box(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
  doc.rect(x, y, w, h).stroke();
}

function field(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  rowY: number,
  w: number,
  size = 7,
) {
  lbl(doc, label, x, rowY, w);
  doc.font("Helvetica").fontSize(size).fillColor("#000").text(value || "—", x + PAD, rowY + 9, {
    width: w - PAD * 2,
    lineBreak: false,
    ellipsis: true,
  });
}

export function danfePdfFilename(invoiceId: string, number?: number | null): string {
  const suffix = number != null ? String(number) : invoiceId.slice(0, 8);
  return `danfe-${suffix}.pdf`;
}

async function renderBarcode(
  doc: PDFKit.PDFDocument,
  accessKey: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  try {
    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text: accessKey.replace(/\D/g, ""),
      scale: 2,
      height: 8,
      includetext: false,
    });
    doc.image(png, x, y, { width: w, height: h });
  } catch {
    doc.fontSize(6).text(formatAccessKeyDisplay(accessKey), x, y + 4, { width: w, align: "center" });
  }
}

function drawLogoColumn(
  doc: PDFKit.PDFDocument,
  logo: { buffer: Buffer; mimeType: string },
  x: number,
  y: number,
  w: number,
  h: number,
) {
  box(doc, x, y, w, h);
  if (!pdfKitLogoMime(logo.mimeType)) return;
  const pad = 3;
  try {
    doc.image(logo.buffer, x + pad, y + pad, {
      fit: [w - pad * 2, h - pad * 2],
      align: "center",
      valign: "center",
    });
  } catch {
    // mantém a área reservada mesmo se a imagem falhar
  }
}

function emitterAddress(p: DanfeNfeData["emitter"]): string {
  const zip = p.zipCode?.replace(/\D/g, "");
  const zipFmt = zip && zip.length === 8 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : p.zipCode;
  const line1 = [p.street, p.number ? (p.number.toLowerCase().startsWith("s") ? p.number : `nº ${p.number}`) : null, p.district]
    .filter(Boolean)
    .join(", ");
  const line2 = [zipFmt, p.city, p.state ? ` - ${p.state}` : null].filter(Boolean).join(" ");
  return [line1, line2].filter(Boolean).join("\n");
}

function drawCanhoto(doc: PDFKit.PDFDocument, data: DanfeNfeData, y: number, x: number, w: number) {
  box(doc, x, y, w, CANHOTO_H);
  doc.font("Helvetica").fontSize(6).text(
    `RECEBEMOS DE ${data.emitter.name} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO. ` +
      `EMISSÃO: ${fmtBrDate(data.issuedAt)}  VALOR TOTAL: ${fmtBrMoney(data.totalNfe)}  ` +
      `DESTINATÁRIO: ${data.recipient.name} - ${[data.recipient.street, data.recipient.district, data.recipient.city, data.recipient.state].filter(Boolean).join(", ")}`,
    x + PAD,
    y + PAD,
    { width: w * 0.72, height: 34 },
  );
  const sideX = x + w * 0.74;
  box(doc, sideX, y, w * 0.26, CANHOTO_H);
  doc.fontSize(8).text("NF-e", sideX + PAD, y + PAD);
  doc.fontSize(7).text(`SÉRIE ${data.series}`, sideX + PAD, y + 16);
  doc.fontSize(10).text(fmtNfNumber(data.number), sideX + PAD, y + 28);
  lbl(doc, "DATA DO RECEBIMENTO", x, y + 46, w * 0.35);
  lbl(doc, "IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR", x + w * 0.35, y + 46, w * 0.37);
}

async function drawHeader(
  doc: PDFKit.PDFDocument,
  data: DanfeNfeData,
  y: number,
  x: number,
  w: number,
) {
  const innerW = w - GAP * 2;
  const emitW = innerW * 0.5;
  const danfeW = innerW * 0.17;
  const rightW = innerW - emitW - danfeW;
  const emitX = x;
  const danfeX = emitX + emitW + GAP;
  const rightX = danfeX + danfeW + GAP;

  box(doc, emitX, y, emitW, HDR_H);
  lbl(doc, "IDENTIFICAÇÃO DO EMITENTE", emitX, y, emitW);
  doc.font("Helvetica-Bold").fontSize(9).text(data.emitter.name, emitX + PAD, y + 12, {
    width: emitW - PAD * 2,
    lineBreak: false,
    ellipsis: true,
  });
  doc.font("Helvetica").fontSize(7).text(emitterAddress(data.emitter), emitX + PAD, y + 24, {
    width: emitW - PAD * 2,
    height: 24,
  });
  if (data.emitter.phone) {
    doc.fontSize(7).text(`FONE/FAX: ${data.emitter.phone}`, emitX + PAD, y + 50, {
      width: emitW - PAD * 2,
      lineBreak: false,
    });
  }

  box(doc, danfeX, y, danfeW, HDR_H);
  doc.font("Helvetica-Bold").fontSize(11).text("DANFE", danfeX, y + 8, { width: danfeW, align: "center" });
  doc.font("Helvetica").fontSize(6.5).text("Documento Auxiliar da", danfeX, y + 22, { width: danfeW, align: "center" });
  doc.text("NOTA FISCAL ELETRÔNICA", danfeX, y + 30, { width: danfeW, align: "center" });
  doc.fontSize(6).text("0 - ENTRADA", danfeX + PAD, y + 44);
  doc.text("1 - SAÍDA", danfeX + PAD, y + 52);
  doc.font("Helvetica-Bold").fontSize(12).text(data.tpNF, danfeX + danfeW - 18, y + 46);
  doc.font("Helvetica-Bold").fontSize(11).text(`Nº ${fmtNfNumber(data.number)}`, danfeX, y + 64, {
    width: danfeW,
    align: "center",
  });
  doc.font("Helvetica").fontSize(7).text(`SÉRIE ${data.series}`, danfeX, y + 80, { width: danfeW, align: "center" });
  doc.text("FOLHA 1/1", danfeX, y + 90, { width: danfeW, align: "center" });

  box(doc, rightX, y, rightW, HDR_H);
  lbl(doc, "CHAVE DE ACESSO", rightX, y, rightW);
  await renderBarcode(doc, data.accessKey, rightX + PAD, y + 14, rightW - PAD * 2, 34);
  doc.font("Courier").fontSize(7).text(formatAccessKeyDisplay(data.accessKey), rightX + PAD, y + 52, {
    width: rightW - PAD * 2,
    align: "center",
  });
  doc.font("Helvetica").fontSize(5).fillColor("#333").text(
    "Consulta em www.nfe.fazenda.gov.br/portal",
    rightX + PAD,
    y + 66,
    { width: rightW - PAD * 2,
    align: "center" },
  );
  doc.fillColor("#000");
  if (data.environment === "HOMOLOGATION") {
    doc.fontSize(6).fillColor("#b45309").text("SEM VALOR FISCAL", rightX + PAD, y + 78, {
      width: rightW - PAD * 2,
      align: "center",
    });
    doc.fillColor("#000");
  }
  if (data.cancelled) {
    doc.fontSize(7).fillColor("#b91c1c").text("CANCELADA", rightX + PAD, y + 88, {
      width: rightW - PAD * 2,
      align: "center",
    });
    doc.fillColor("#000");
  }
}

export async function buildDanfePdf(data: DanfeNfeData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  let y = M;

  const hasLogo = Boolean(data.logo);

  if (hasLogo && data.logo) {
    drawLogoColumn(doc, data.logo, M, y, LOGO_COL_W, CANHOTO_H);
    drawCanhoto(doc, data, y, M + LOGO_COL_W + GAP, W - LOGO_COL_W - GAP);
  } else {
    drawCanhoto(doc, data, y, M, W);
  }
  y = advance(y, CANHOTO_H);

  await drawHeader(doc, data, y, M, W);
  y = advance(y, HDR_H);

  const natH = 30;
  const natW = (W - GAP) * 0.48;
  box(doc, M, y, natW, natH);
  field(doc, "NATUREZA DA OPERAÇÃO", data.nature ?? "—", M, y + 2, natW);

  box(doc, M + natW + GAP, y, W - natW - GAP, natH);
  field(
    doc,
    "PROTOCOLO DE AUTORIZAÇÃO DE USO",
    data.protocol ? `${data.protocol} ${fmtBrDateTime(data.protocolDate)}` : "—",
    M + natW + GAP,
    y + 2,
    W - natW - GAP,
    6.5,
  );
  y = advance(y, natH);

  const idH = 26;
  const idW = (W - GAP) / 2;
  box(doc, M, y, idW, idH);
  field(doc, "INSCRIÇÃO ESTADUAL", data.emitter.ie ?? "—", M, y + 2, idW);
  box(doc, M + idW + GAP, y, idW, idH);
  field(doc, "CNPJ", fmtDoc(data.emitter.document), M + idW + GAP, y + 2, idW);
  y = advance(y, idH);

  const destH = 14 + FIELD_ROW_H * 4;
  box(doc, M, y, W, destH);
  lbl(doc, "DESTINATÁRIO / REMETENTE", M, y, W);
  const bodyY = y + 14;
  const c1 = W / 3;

  field(doc, "NOME / RAZÃO SOCIAL", data.recipient.name, M, bodyY, c1);
  field(doc, "CNPJ / CPF", fmtDoc(data.recipient.document), M + c1, bodyY, c1);
  field(doc, "DATA DA EMISSÃO", fmtBrDate(data.issuedAt), M + c1 * 2, bodyY, c1);

  const r2 = bodyY + FIELD_ROW_H;
  field(doc, "ENDEREÇO", [data.recipient.street, data.recipient.number].filter(Boolean).join(", "), M, r2, c1);
  field(doc, "BAIRRO / DISTRITO", data.recipient.district ?? "—", M + c1, r2, c1);
  field(doc, "CEP", data.recipient.zipCode ?? "—", M + c1 * 2, r2, c1 * 0.4);
  field(doc, "DATA DA SAÍDA", fmtBrDate(data.exitAt ?? data.issuedAt), M + c1 * 2 + c1 * 0.4, r2, c1 * 0.6);

  const r3 = r2 + FIELD_ROW_H;
  field(doc, "MUNICÍPIO", data.recipient.city ?? "—", M, r3, c1);
  field(doc, "UF", data.recipient.state ?? "—", M + c1, r3, c1 * 0.2);
  field(doc, "INSCRIÇÃO ESTADUAL", data.recipient.ie ?? "—", M + c1 + c1 * 0.2, r3, c1 * 0.45);
  field(doc, "FONE / FAX", data.recipient.phone ?? "—", M + c1 * 2, r3, c1);

  const r4 = r3 + FIELD_ROW_H;
  if (data.exitAt) {
    field(
      doc,
      "HORA DA SAÍDA",
      data.exitAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      M + c1 * 2,
      r4,
      c1,
      6.5,
    );
  }
  y = advance(y, destH);

  const impH = 58;
  box(doc, M, y, W, impH);
  lbl(doc, "CÁLCULO DO IMPOSTO", M, y, W);
  const iw = W / 4;
  const iy = y + 12;
  const impFields = [
    ["BASE CÁLC. ICMS", fmtBrMoney(data.icmsBase ?? 0)],
    ["VALOR ICMS", fmtBrMoney(data.icmsValue ?? 0)],
    ["BASE CÁLC. ICMS ST", fmtBrMoney(data.icmsStBase ?? 0)],
    ["VALOR ICMS ST", fmtBrMoney(data.icmsStValue ?? 0)],
    ["TOTAL DOS PRODUTOS", fmtBrMoney(data.totalProducts)],
    ["VALOR FRETE", fmtBrMoney(data.freight ?? 0)],
    ["VALOR SEGURO", fmtBrMoney(data.insurance ?? 0)],
    ["DESCONTO", fmtBrMoney(data.discount ?? 0)],
    ["OUTRAS DESP.", fmtBrMoney(data.otherExpenses ?? 0)],
    ["VALOR IPI", fmtBrMoney(data.ipi ?? 0)],
    ["TOTAL DA NOTA", fmtBrMoney(data.totalNfe)],
  ];
  impFields.forEach(([label, value], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = M + col * iw;
    const yy = iy + row * 15;
    field(doc, label, value, x, yy, iw, 6.5);
  });
  y = advance(y, impH);

  const trH = 38;
  box(doc, M, y, W, trH);
  lbl(doc, "TRANSPORTADOR / VOLUMES TRANSPORTADOS", M, y, W);
  const freteLabels: Record<string, string> = {
    "0": "0-Remetente",
    "1": "1-Destinatário",
    "2": "2-Terceiros",
    "3": "3-Próprio remetente",
    "4": "4-Próprio destinatário",
    "9": "9-Sem frete",
  };
  const frete = freteLabels[data.freightMode ?? "9"] ?? data.freightMode ?? "—";
  doc.fontSize(6).text(`FRETE POR CONTA: ${frete}`, M + PAD, y + 16, { width: W * 0.42, lineBreak: false });
  if (data.volumeQty || data.grossWeight || data.netWeight) {
    doc.text(
      `QUANTIDADE: ${data.volumeQty ?? 0}  PESO BRUTO: ${fmtBrMoney(data.grossWeight ?? 0)}  PESO LÍQUIDO: ${fmtBrMoney(data.netWeight ?? 0)}`,
      M + W * 0.44,
      y + 16,
      { width: W * 0.52, lineBreak: false },
    );
  }
  y = advance(y, trH);

  const itemsHdrH = 16;
  box(doc, M, y, W, itemsHdrH);
  lbl(doc, "DADOS DOS PRODUTOS / SERVIÇOS", M, y, W);
  y = advance(y, itemsHdrH);

  const cols = [
    { label: "CÓD.", w: 30 },
    { label: "DESCRIÇÃO", w: 168 },
    { label: "NCM", w: 44 },
    { label: "CSOSN", w: 32 },
    { label: "CFOP", w: 30 },
    { label: "UN", w: 24 },
    { label: "QTD", w: 40 },
    { label: "V.UNIT", w: 44 },
    { label: "V.TOTAL", w: 50 },
    { label: "BC ICMS", w: 44 },
    { label: "V.ICMS", w: 40 },
    { label: "ALÍQ", w: 29 },
  ];
  let cx = M;
  box(doc, M, y, W, 14);
  doc.fontSize(5).fillColor("#333");
  for (const c of cols) {
    doc.text(c.label, cx + 2, y + 3, { width: c.w - 4, lineBreak: false });
    cx += c.w;
  }
  doc.fillColor("#000");
  y = advance(y, 14);

  const maxItemsY = PAGE_H - M - 50;
  for (const it of data.items) {
    if (y > maxItemsY) {
      doc.addPage();
      y = M;
    }
    const rowH = 14;
    box(doc, M, y, W, rowH);
    cx = M;
    const cells = [
      it.productCode ?? String(it.lineNumber),
      it.description,
      it.ncm ?? "",
      it.csosn ?? "",
      it.cfop ?? "",
      it.unit ?? "",
      String(it.quantity),
      fmtBrMoney(it.unitPrice),
      fmtBrMoney(it.totalPrice),
      fmtBrMoney(it.icmsBase ?? 0),
      fmtBrMoney(it.icmsValue ?? 0),
      it.icmsRate ? `${it.icmsRate}` : "0",
    ];
    doc.fontSize(6);
    for (let i = 0; i < cols.length; i++) {
      doc.text(cells[i] ?? "", cx + 2, y + 3, { width: cols[i]!.w - 4, lineBreak: false, ellipsis: true });
      cx += cols[i]!.w;
    }
    y = advance(y, rowH) - GAP;
  }
  y += GAP;

  const adH = 48;
  box(doc, M, y, W, adH);
  lbl(doc, "DADOS ADICIONAIS", M, y, W);
  field(doc, "INFORMAÇÕES COMPLEMENTARES", data.additionalInfo ?? "", M, y + 12, W * 0.72, 6.5);
  field(doc, "RESERVADO AO FISCO", "", M + W * 0.74, y + 12, W * 0.26 - GAP, 6.5);

  doc.fontSize(6).fillColor("#666").text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} — Noxus-GO`,
    M,
    PAGE_H - M - 8,
    { width: W, align: "center" },
  );

  doc.end();
  return done;
}
