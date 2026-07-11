import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import type { DanfeNfeData } from "../fiscal/nfe-xml-danfe.js";
import { formatAccessKeyDisplay } from "../fiscal/nfe-xml-danfe.js";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 10;
const W = PAGE_W - M * 2;
const CANHOTO_H = 95;

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

function lbl(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w?: number) {
  doc.fontSize(5.5).fillColor("#333").text(text, x + 2, y + 2, { width: w ? w - 4 : undefined });
  doc.fillColor("#000");
}

function box(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
  doc.rect(x, y, w, h).stroke();
}

function val(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number, size = 7.5) {
  doc.fontSize(size).text(text || "—", x + 2, y + 11, { width: w - 4 });
}

export function danfePdfFilename(invoiceId: string, number?: number | null): string {
  const suffix = number != null ? String(number) : invoiceId.slice(0, 8);
  return `danfe-${suffix}.pdf`;
}

async function renderBarcode(doc: PDFKit.PDFDocument, accessKey: string, x: number, y: number, w: number) {
  try {
    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text: accessKey,
      scale: 2,
      height: 10,
      includetext: false,
    });
    doc.image(png, x, y, { width: w, height: 28 });
  } catch {
    doc.fontSize(6).text(formatAccessKeyDisplay(accessKey), x, y, { width: w });
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

export async function buildDanfePdf(data: DanfeNfeData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  let y = M;

  // ── Cabeçalho: emitente | DANFE | número ──
  const hdrH = 88;
  const emitW = W * 0.52;
  const danfeW = W * 0.22;
  const numW = W - emitW - danfeW;

  box(doc, M, y, emitW, hdrH);
  lbl(doc, "IDENTIFICAÇÃO DO EMITENTE", M, y, emitW);
  doc.fontSize(9).text(data.emitter.name, M + 4, y + 14, { width: emitW - 8 });
  doc.fontSize(7).text(emitterAddress(data.emitter), M + 4, y + 28, { width: emitW - 8 });
  if (data.emitter.phone) doc.fontSize(7).text(`FONE: ${data.emitter.phone}`, M + 4, y + 52);
  doc.fontSize(7);
  doc.text(`INSCRIÇÃO ESTADUAL  ${data.emitter.ie ?? "—"}`, M + 4, y + 64, { continued: true, width: emitW / 2 });
  doc.text(`CNPJ  ${fmtDoc(data.emitter.document)}`, { width: emitW / 2 });

  box(doc, M + emitW, y, danfeW, hdrH);
  doc.fontSize(11).text("DANFE", M + emitW, y + 10, { width: danfeW, align: "center" });
  doc.fontSize(7).text("Documento Auxiliar da", M + emitW, y + 24, { width: danfeW, align: "center" });
  doc.fontSize(7).text("NOTA FISCAL ELETRÔNICA", M + emitW, y + 32, { width: danfeW, align: "center" });
  doc.fontSize(6).text("0 - ENTRADA", M + emitW + 6, y + 48);
  doc.fontSize(6).text("1 - SAÍDA", M + emitW + 6, y + 56);
  doc.fontSize(12).text(data.tpNF, M + emitW + danfeW - 22, y + 50);
  doc.fontSize(6).text("Consulta de autenticidade no portal nacional da NF-e", M + emitW + 4, y + 66, {
    width: danfeW - 8,
    align: "center",
  });
  doc.fontSize(5.5).text("www.nfe.fazenda.gov.br/portal", M + emitW + 4, y + 74, { width: danfeW - 8, align: "center" });

  box(doc, M + emitW + danfeW, y, numW, hdrH);
  lbl(doc, "Nº", M + emitW + danfeW, y, numW);
  doc.fontSize(14).text(fmtNfNumber(data.number), M + emitW + danfeW + 4, y + 16);
  doc.fontSize(8).text(`SÉRIE ${data.series}`, M + emitW + danfeW + 4, y + 38);
  doc.fontSize(7).text("FOLHA 1/1", M + emitW + danfeW + 4, y + 52);
  if (data.environment === "HOMOLOGATION") {
    doc.fontSize(7).fillColor("#b45309").text("SEM VALOR FISCAL — HOMOLOGAÇÃO", M + emitW + danfeW + 4, y + 66, {
      width: numW - 8,
    });
    doc.fillColor("#000");
  }
  if (data.cancelled) {
    doc.fontSize(8).fillColor("#b91c1c").text("NOTA FISCAL CANCELADA", M + emitW + danfeW + 4, y + 76, { width: numW - 8 });
    doc.fillColor("#000");
  }

  y += hdrH;

  // ── Chave de acesso + código de barras ──
  const chH = 48;
  box(doc, M, y, W, chH);
  lbl(doc, "CHAVE DE ACESSO", M, y, W);
  doc.font("Courier").fontSize(9).text(formatAccessKeyDisplay(data.accessKey), M + 4, y + 12, { width: W - 8 });
  doc.font("Helvetica");
  await renderBarcode(doc, data.accessKey, M + 4, y + 24, W - 8);
  y += chH;

  // ── Natureza | Protocolo ──
  const natH = 26;
  const natW = W * 0.45;
  box(doc, M, y, natW, natH);
  lbl(doc, "NATUREZA DA OPERAÇÃO", M, y, natW);
  val(doc, data.nature ?? "—", M, y, natW);

  box(doc, M + natW, y, W - natW, natH);
  lbl(doc, "PROTOCOLO DE AUTORIZAÇÃO DE USO", M + natW, y, W - natW);
  val(
    doc,
    data.protocol ? `${data.protocol} ${fmtBrDateTime(data.protocolDate)}` : "—",
    M + natW,
    y,
    W - natW,
  );
  y += natH;

  // ── Destinatário ──
  const destH = 68;
  box(doc, M, y, W, destH);
  lbl(doc, "DESTINATÁRIO / REMETENTE", M, y, W);
  const c1 = W / 3;
  const r1 = y + 12;
  lbl(doc, "NOME / RAZÃO SOCIAL", M, r1, c1);
  val(doc, data.recipient.name, M, r1 + 8, c1);
  lbl(doc, "CNPJ / CPF", M + c1, r1, c1);
  val(doc, fmtDoc(data.recipient.document), M + c1, r1 + 8, c1);
  lbl(doc, "DATA DA EMISSÃO", M + c1 * 2, r1, c1);
  val(doc, fmtBrDate(data.issuedAt), M + c1 * 2, r1 + 8, c1);

  const r2 = r1 + 28;
  lbl(doc, "ENDEREÇO", M, r2, c1);
  val(doc, [data.recipient.street, data.recipient.number].filter(Boolean).join(", "), M, r2 + 8, c1);
  lbl(doc, "BAIRRO / DISTRITO", M + c1, r2, c1);
  val(doc, data.recipient.district ?? "—", M + c1, r2 + 8, c1);
  lbl(doc, "CEP", M + c1 * 2, r2, c1 * 0.45);
  val(doc, data.recipient.zipCode ?? "—", M + c1 * 2, r2 + 8, c1 * 0.45);
  lbl(doc, "DATA DA SAÍDA", M + c1 * 2 + c1 * 0.45, r2, c1 * 0.55);
  val(doc, fmtBrDate(data.exitAt ?? data.issuedAt), M + c1 * 2 + c1 * 0.45, r2 + 8, c1 * 0.55);

  const r3 = r2 + 28;
  lbl(doc, "MUNICÍPIO", M, r3, c1);
  val(doc, data.recipient.city ?? "—", M, r3 + 8, c1);
  lbl(doc, "UF", M + c1, r3, c1 * 0.25);
  val(doc, data.recipient.state ?? "—", M + c1, r3 + 8, c1 * 0.25);
  lbl(doc, "INSCRIÇÃO ESTADUAL", M + c1 + c1 * 0.25, r3, c1 * 0.45);
  val(doc, data.recipient.ie ?? "—", M + c1 + c1 * 0.25, r3 + 8, c1 * 0.45);
  lbl(doc, "FONE / FAX", M + c1 * 2, r3, c1);
  val(doc, data.recipient.phone ?? "—", M + c1 * 2, r3 + 8, c1);
  if (data.exitAt) {
    lbl(doc, "HORA DA SAÍDA", M + c1 * 2 + c1 * 0.45, r2 + 18, c1 * 0.55);
    val(
      doc,
      data.exitAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      M + c1 * 2 + c1 * 0.45,
      r2 + 26,
      c1 * 0.55,
      6.5,
    );
  }
  y += destH;

  // ── Cálculo do imposto ──
  const impH = 42;
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
    const yy = iy + row * 14;
    doc.fontSize(5).fillColor("#333").text(label, x + 2, yy);
    doc.fontSize(7).fillColor("#000").text(value, x + 2, yy + 6, { width: iw - 4 });
  });
  y += impH;

  // ── Transportador (resumido) ──
  const trH = 36;
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
  doc.fontSize(6).text(`FRETE POR CONTA: ${frete}`, M + 4, y + 14);
  if (data.volumeQty || data.grossWeight || data.netWeight) {
    doc.text(
      `QUANTIDADE: ${data.volumeQty ?? 0}  PESO BRUTO: ${fmtBrMoney(data.grossWeight ?? 0)}  PESO LÍQUIDO: ${fmtBrMoney(data.netWeight ?? 0)}`,
      M + W * 0.45,
      y + 14,
      { width: W * 0.5 },
    );
  }
  y += trH;

  // ── Itens ──
  const itemsHdrH = 14;
  box(doc, M, y, W, itemsHdrH);
  lbl(doc, "DADOS DOS PRODUTOS / SERVIÇOS", M, y, W);
  y += itemsHdrH;

  const cols = [
    { label: "CÓD.", w: 28 },
    { label: "DESCRIÇÃO", w: 130 },
    { label: "NCM", w: 42 },
    { label: "CSOSN", w: 30 },
    { label: "CFOP", w: 28 },
    { label: "UN", w: 22 },
    { label: "QTD", w: 38 },
    { label: "V.UNIT", w: 42 },
    { label: "V.TOTAL", w: 48 },
    { label: "BC ICMS", w: 42 },
    { label: "V.ICMS", w: 38 },
    { label: "ALÍQ", w: 30 },
  ];
  let cx = M;
  box(doc, M, y, W, 12);
  doc.fontSize(5).fillColor("#333");
  for (const c of cols) {
    doc.text(c.label, cx + 1, y + 2, { width: c.w - 2 });
    cx += c.w;
  }
  doc.fillColor("#000");
  y += 12;

  const maxItemsY = PAGE_H - M - CANHOTO_H - 55;
  for (const it of data.items) {
    if (y > maxItemsY) {
      doc.addPage();
      y = M;
    }
    const rowH = 12;
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
      doc.text(cells[i] ?? "", cx + 1, y + 2, { width: cols[i]!.w - 2, lineBreak: false });
      cx += cols[i]!.w;
    }
    y += rowH;
  }

  // ── Dados adicionais ──
  const adH = 42;
  box(doc, M, y, W, adH);
  lbl(doc, "DADOS ADICIONAIS", M, y, W);
  lbl(doc, "INFORMAÇÕES COMPLEMENTARES", M, y + 10, W * 0.7);
  val(doc, data.additionalInfo ?? "", M, y + 18, W * 0.7, 6.5);
  y += adH;

  // ── Canhoto ──
  const canY = PAGE_H - M - CANHOTO_H;
  box(doc, M, canY, W, CANHOTO_H);
  doc.fontSize(6).text(
    `RECEBEMOS DE ${data.emitter.name} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO. ` +
      `EMISSÃO: ${fmtBrDate(data.issuedAt)}  VALOR TOTAL: ${fmtBrMoney(data.totalNfe)}  ` +
      `DESTINATÁRIO: ${data.recipient.name} - ${[data.recipient.street, data.recipient.district, data.recipient.city, data.recipient.state].filter(Boolean).join(", ")}`,
    M + 4,
    canY + 6,
    { width: W * 0.72 },
  );
  box(doc, M + W * 0.74, canY, W * 0.26, CANHOTO_H);
  doc.fontSize(8).text("NF-e", M + W * 0.76, canY + 6);
  doc.fontSize(7).text(`SÉRIE ${data.series}`, M + W * 0.76, canY + 18);
  doc.fontSize(10).text(fmtNfNumber(data.number), M + W * 0.76, canY + 28);
  lbl(doc, "DATA DO RECEBIMENTO", M, canY + 52, W * 0.35);
  lbl(doc, "IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR", M + W * 0.35, canY + 52, W * 0.37);

  doc.fontSize(6).fillColor("#666").text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} — Noxus-GO`,
    M,
    PAGE_H - M - 8,
    { width: W, align: "center" },
  );

  doc.end();
  return done;
}
