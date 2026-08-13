import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import { pdfKitLogoMime } from "../fiscal/danfe-logo.js";
import type { DanfeNfeData } from "../fiscal/nfe-xml-danfe.js";
import { formatAccessKeyDisplay } from "../fiscal/nfe-xml-danfe.js";

/** A4 em pontos — medidas alinhadas ao UniDANFE (margem ~21.6, conteúdo ~551). */
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 21.6;
const W = PAGE_W - M * 2;
const PAD = 2.2;
const LINE = 0.6;
const CANHOTO_H = 58;
const HEADER_H = 108;
const ROW_H = 18;
const TITLE_H = 10;
const ITEM_ROW_H = 18.6;
const ITEM_ROW_H_BARCODE = 20;

function fmtBrMoney(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtQty(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

/** UniDANFE exibe pesos com 3 casas (ex.: 444,000). */
function fmtWeight(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function fmtBrDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("pt-BR");
}

function fmtBrTime(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtBrDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleString("pt-BR");
}

function fmtDoc(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14)
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return doc;
}

/** IE no estilo UniDANFE (ex.: 62.665.982). */
function fmtIe(ie: string | undefined): string {
  if (!ie) return "";
  const d = ie.replace(/\D/g, "");
  if (!d || d.length < 2) return ie;
  const parts: string[] = [];
  let rest = d;
  while (rest.length > 3) {
    parts.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
  }
  if (rest) parts.unshift(rest);
  return parts.join(".");
}

function fmtCep(cep: string | undefined): string {
  const d = (cep ?? "").replace(/\D/g, "");
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return cep ?? "";
}

function fmtNfNumber(n: number): string {
  return String(n)
    .padStart(9, "0")
    .replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
}

function strokeRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.lineWidth(LINE).rect(x, y, w, h).stroke("#000");
}

function hLine(doc: PDFKit.PDFDocument, x: number, y: number, w: number) {
  doc
    .lineWidth(LINE)
    .moveTo(x, y)
    .lineTo(x + w, y)
    .stroke("#000");
}

function vLine(doc: PDFKit.PDFDocument, x: number, y: number, h: number) {
  doc
    .lineWidth(LINE)
    .moveTo(x, y)
    .lineTo(x, y + h)
    .stroke("#000");
}

function label(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
) {
  doc
    .font("Helvetica")
    .fontSize(4.8)
    .fillColor("#222")
    .text(text, x + PAD, y + 1.2, { width: w - PAD * 2, lineBreak: false });
  doc.fillColor("#000");
}

function value(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  opts?: { size?: number; bold?: boolean; align?: "left" | "center" | "right" },
) {
  doc
    .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts?.size ?? 7)
    .fillColor("#000")
    .text(text || " ", x + PAD, y, {
      width: w - PAD * 2,
      align: opts?.align ?? "left",
      lineBreak: false,
      ellipsis: true,
    });
}

function sectionTitle(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(5.5)
    .fillColor("#000")
    .text(text, x + PAD, y + 2, { width: w - PAD * 2, lineBreak: false });
}

function cell(
  doc: PDFKit.PDFDocument,
  lbl: string,
  val: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { size?: number; bold?: boolean },
) {
  strokeRect(doc, x, y, w, h);
  label(doc, lbl, x, y, w);
  value(doc, val, x, y + 8, w, { size: opts?.size ?? 7, bold: opts?.bold });
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
      height: 10,
      includetext: false,
    });
    doc.image(png, x, y, { width: w, height: h });
  } catch {
    doc
      .font("Courier")
      .fontSize(6)
      .text(formatAccessKeyDisplay(accessKey), x, y + 4, {
        width: w,
        align: "center",
      });
  }
}

function emitterAddressLines(p: DanfeNfeData["emitter"]): string[] {
  const line1 = [p.street, p.district].filter(Boolean).join(" - ");
  const cityUf = [p.city, p.state].filter(Boolean).join(" - ");
  const line2 = [fmtCep(p.zipCode), cityUf].filter(Boolean).join(" ");
  const line3 = p.phone ? `FONE: ${p.phone}` : "";
  return [line1, line2, line3].filter(Boolean);
}

function drawCanhoto(
  doc: PDFKit.PDFDocument,
  data: DanfeNfeData,
  y: number,
): number {
  const sideW = 78;
  const mainW = W - sideW;

  strokeRect(doc, M, y, W, CANHOTO_H);
  vLine(doc, M + mainW, y, CANHOTO_H);

  const destAddr = [
    data.recipient.street,
    data.recipient.number,
    data.recipient.district,
    `${fmtCep(data.recipient.zipCode)}-${data.recipient.city ?? ""}-${data.recipient.state ?? ""}`,
  ]
    .filter(Boolean)
    .join(", ");

  doc
    .font("Helvetica")
    .fontSize(5.5)
    .text(
      `RECEBEMOS DE ${data.emitter.name} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.  ` +
        `EMISSÃO: ${fmtBrDate(data.issuedAt)}  VALOR TOTAL: ${fmtBrMoney(data.totalNfe)}  ` +
        `DESTINATÁRIO: ${data.recipient.name}${destAddr ? ` - ${destAddr}` : ""}`,
      M + PAD,
      y + PAD,
      { width: mainW - PAD * 2, height: 28 },
    );

  hLine(doc, M, y + 32, mainW);
  vLine(doc, M + 103, y + 32, CANHOTO_H - 32);
  label(doc, "DATA DO RECEBIMENTO", M, y + 32, 103);
  label(
    doc,
    "IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR",
    M + 103,
    y + 32,
    mainW - 103,
  );

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("NF-e", M + mainW + PAD, y + 6, {
      width: sideW - PAD * 2,
      align: "center",
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(fmtNfNumber(data.number), M + mainW + PAD, y + 22, {
      width: sideW - PAD * 2,
      align: "center",
    });
  doc
    .font("Helvetica")
    .fontSize(7)
    .text(`SÉRIE ${data.series}`, M + mainW + PAD, y + 38, {
      width: sideW - PAD * 2,
      align: "center",
    });

  return y + CANHOTO_H;
}

function drawCutLine(doc: PDFKit.PDFDocument, y: number): number {
  const yy = y + 4;
  doc
    .font("Helvetica")
    .fontSize(5.5)
    .fillColor("#333")
    .text("- ".repeat(95).trim(), M - 4, yy - 2, {
      width: W + 8,
      align: "left",
      lineBreak: false,
    });
  doc.fillColor("#000");
  return yy + 8;
}

async function drawHeader(
  doc: PDFKit.PDFDocument,
  data: DanfeNfeData,
  y: number,
): Promise<number> {
  // Proporções UniDANFE: emitente ~45% | DANFE ~14% | chave ~41%
  const emitW = W * 0.45;
  const danfeW = W * 0.14;
  const keyW = W - emitW - danfeW;
  const emitX = M;
  const danfeX = emitX + emitW;
  const keyX = danfeX + danfeW;

  strokeRect(doc, M, y, W, HEADER_H);
  vLine(doc, danfeX, y, HEADER_H);
  vLine(doc, keyX, y, HEADER_H);

  label(doc, "IDENTIFICAÇÃO DO EMITENTE", emitX, y, emitW);
  const logo = data.logo;
  const hasLogo = Boolean(logo && pdfKitLogoMime(logo.mimeType));
  const logoW = hasLogo ? 48 : 0;
  const textX = emitX + PAD + (hasLogo ? logoW + 4 : 0);
  const textW = emitW - PAD * 2 - (hasLogo ? logoW + 4 : 0);

  if (hasLogo && logo) {
    try {
      doc.image(logo.buffer, emitX + PAD, y + 14, {
        fit: [logoW, 48],
        align: "center",
        valign: "center",
      });
    } catch {
      /* área vazia se logo inválida */
    }
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(data.emitter.name, textX, y + 14, {
      width: textW,
      height: 24,
    });
  doc
    .font("Helvetica")
    .fontSize(6.5)
    .text(emitterAddressLines(data.emitter).join("\n"), textX, y + 42, {
      width: textW,
      height: 50,
    });

  // Bloco DANFE — subtítulo em 4 linhas (padrão UniDANFE)
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("DANFE", danfeX, y + 4, { width: danfeW, align: "center" });
  doc.font("Helvetica").fontSize(5);
  for (const [i, line] of [
    "DOCUMENTO",
    "AUXILIAR DA",
    "NOTA FISCAL",
    "ELETRÔNICA",
  ].entries()) {
    doc.text(line, danfeX + 1, y + 18 + i * 7, {
      width: danfeW - 2,
      align: "center",
    });
  }

  doc.fontSize(5.5).text("0-ENTRADA", danfeX + 3, y + 50);
  doc.text("1-SAÍDA", danfeX + 3, y + 58);
  strokeRect(doc, danfeX + danfeW - 18, y + 50, 14, 14);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(data.tpNF, danfeX + danfeW - 18, y + 52.5, {
      width: 14,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(fmtNfNumber(data.number), danfeX, y + 72, {
      width: danfeW,
      align: "center",
    });
  doc
    .font("Helvetica")
    .fontSize(7)
    .text(`SÉRIE ${data.series}`, danfeX, y + 86, {
      width: danfeW,
      align: "center",
    });
  doc.fontSize(6.5).text("FOLHA 1/1", danfeX, y + 97, {
    width: danfeW,
    align: "center",
  });

  // UniDANFE: barras no topo → CHAVE → dígitos → caixa de consulta
  await renderBarcode(doc, data.accessKey, keyX + 8, y + 4, keyW - 16, 24);
  hLine(doc, keyX, y + 30, keyW);
  label(doc, "CHAVE DE ACESSO", keyX, y + 30, keyW);
  doc
    .font("Courier")
    .fontSize(6.5)
    .text(formatAccessKeyDisplay(data.accessKey), keyX + 4, y + 40, {
      width: keyW - 8,
      align: "center",
    });
  hLine(doc, keyX, y + 52, keyW);
  doc
    .font("Helvetica")
    .fontSize(5)
    .fillColor("#333")
    .text(
      "Consulta de autenticidade no portal nacional da NF-e\nou no site da Sefaz Autorizadora\nwww.nfe.fazenda.gov.br/portal",
      keyX + 4,
      y + 56,
      { width: keyW - 8, align: "center" },
    );
  doc.fillColor("#000");

  if (data.environment === "HOMOLOGATION") {
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor("#b45309")
      .text("SEM VALOR FISCAL — HOMOLOGAÇÃO", keyX + 4, y + 88, {
        width: keyW - 8,
        align: "center",
      });
    doc.fillColor("#000");
  }
  if (data.cancelled) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#b91c1c")
      .text("CANCELADA", keyX + 4, y + 96, {
        width: keyW - 8,
        align: "center",
      });
    doc.fillColor("#000");
  }

  return y + HEADER_H;
}

/** UniDANFE: Natureza + Protocolo logo abaixo do cabeçalho. */
function drawNatureProtocol(
  doc: PDFKit.PDFDocument,
  data: DanfeNfeData,
  y: number,
): number {
  const h = ROW_H;
  const natW = W * 0.68;
  const protW = W - natW;
  cell(doc, "NATUREZA DA OPERAÇÃO", data.nature ?? "", M, y, natW, h);
  cell(
    doc,
    "PROTOCOLO DE AUTORIZAÇÃO DE USO",
    data.protocol
      ? `${data.protocol} ${fmtBrDateTime(data.protocolDate)}`
      : "",
    M + natW,
    y,
    protW,
    h,
    { size: 6.5 },
  );
  return y + h;
}

function drawIeCnpjRow(
  doc: PDFKit.PDFDocument,
  data: DanfeNfeData,
  y: number,
): number {
  const h = ROW_H;
  const c1 = W * 0.34;
  const c2 = W * 0.34;
  const c3 = W - c1 - c2;
  cell(doc, "INSCRIÇÃO ESTADUAL", fmtIe(data.emitter.ie), M, y, c1, h);
  cell(doc, "INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.", "", M + c1, y, c2, h);
  cell(doc, "CNPJ", fmtDoc(data.emitter.document), M + c1 + c2, y, c3, h);
  return y + h;
}

function drawDestinatario(
  doc: PDFKit.PDFDocument,
  data: DanfeNfeData,
  y: number,
): number {
  const blockH = TITLE_H + ROW_H * 3;

  strokeRect(doc, M, y, W, blockH);
  sectionTitle(doc, "DESTINATÁRIO / REMETENTE", M, y, W);
  hLine(doc, M, y + TITLE_H, W);

  const r1 = y + TITLE_H;
  const nameW = W * 0.52;
  const docW = W * 0.28;
  const dateW = W - nameW - docW;
  vLine(doc, M + nameW, r1, ROW_H);
  vLine(doc, M + nameW + docW, r1, ROW_H);
  label(doc, "NOME / RAZÃO SOCIAL", M, r1, nameW);
  value(doc, data.recipient.name, M, r1 + 8, nameW, { bold: true, size: 7.5 });
  label(doc, "CNPJ / CPF", M + nameW, r1, docW);
  value(doc, fmtDoc(data.recipient.document), M + nameW, r1 + 8, docW);
  label(doc, "DATA DA EMISSÃO", M + nameW + docW, r1, dateW);
  value(doc, fmtBrDate(data.issuedAt), M + nameW + docW, r1 + 8, dateW);

  const r2 = r1 + ROW_H;
  hLine(doc, M, r2, W);
  const endW = W * 0.42;
  const baiW = W * 0.24;
  const cepW = W * 0.14;
  const saiW = W - endW - baiW - cepW;
  vLine(doc, M + endW, r2, ROW_H);
  vLine(doc, M + endW + baiW, r2, ROW_H);
  vLine(doc, M + endW + baiW + cepW, r2, ROW_H);
  label(doc, "ENDEREÇO", M, r2, endW);
  value(
    doc,
    [data.recipient.street, data.recipient.number].filter(Boolean).join(", "),
    M,
    r2 + 8,
    endW,
  );
  label(doc, "BAIRRO / DISTRITO", M + endW, r2, baiW);
  value(doc, data.recipient.district ?? "", M + endW, r2 + 8, baiW);
  label(doc, "CEP", M + endW + baiW, r2, cepW);
  value(doc, fmtCep(data.recipient.zipCode), M + endW + baiW, r2 + 8, cepW);
  label(doc, "DATA DA SAÍDA", M + endW + baiW + cepW, r2, saiW);
  value(
    doc,
    fmtBrDate(data.exitAt ?? data.issuedAt),
    M + endW + baiW + cepW,
    r2 + 8,
    saiW,
  );

  // UniDANFE: MUNICÍPIO | UF | FONE/FAX | IE | HORA DA SAÍDA
  const r3 = r2 + ROW_H;
  hLine(doc, M, r3, W);
  const munW = W * 0.36;
  const ufW = W * 0.07;
  const fonW = W * 0.2;
  const ieW = W * 0.2;
  const horW = W - munW - ufW - fonW - ieW;
  vLine(doc, M + munW, r3, ROW_H);
  vLine(doc, M + munW + ufW, r3, ROW_H);
  vLine(doc, M + munW + ufW + fonW, r3, ROW_H);
  vLine(doc, M + munW + ufW + fonW + ieW, r3, ROW_H);
  label(doc, "MUNICÍPIO", M, r3, munW);
  value(doc, data.recipient.city ?? "", M, r3 + 8, munW);
  label(doc, "UF", M + munW, r3, ufW);
  value(doc, data.recipient.state ?? "", M + munW, r3 + 8, ufW, {
    align: "center",
  });
  label(doc, "FONE / FAX", M + munW + ufW, r3, fonW);
  value(doc, data.recipient.phone ?? "", M + munW + ufW, r3 + 8, fonW);
  label(doc, "INSCRIÇÃO ESTADUAL", M + munW + ufW + fonW, r3, ieW);
  value(doc, data.recipient.ie ?? "", M + munW + ufW + fonW, r3 + 8, ieW);
  label(doc, "HORA DA SAÍDA", M + munW + ufW + fonW + ieW, r3, horW);
  value(
    doc,
    fmtBrTime(data.exitAt ?? data.issuedAt),
    M + munW + ufW + fonW + ieW,
    r3 + 8,
    horW,
  );

  return y + blockH;
}

function drawImpostos(
  doc: PDFKit.PDFDocument,
  data: DanfeNfeData,
  y: number,
): number {
  const blockH = TITLE_H + ROW_H * 2;

  strokeRect(doc, M, y, W, blockH);
  sectionTitle(doc, "CÁLCULO DO IMPOSTO", M, y, W);
  hLine(doc, M, y + TITLE_H, W);

  const r1 = y + TITLE_H;
  const w5 = W / 5;
  const row1: [string, string][] = [
    ["BASE CÁLC ICMS", fmtBrMoney(data.icmsBase ?? 0)],
    ["VALOR ICMS", fmtBrMoney(data.icmsValue ?? 0)],
    ["BASE CÁLC ICMS ST", fmtBrMoney(data.icmsStBase ?? 0)],
    ["VALOR ICMS ST", fmtBrMoney(data.icmsStValue ?? 0)],
    ["TOTAL DOS PRODUTOS", fmtBrMoney(data.totalProducts)],
  ];
  row1.forEach(([lbl, val], i) => {
    const x = M + i * w5;
    if (i > 0) vLine(doc, x, r1, ROW_H);
    label(doc, lbl, x, r1, w5);
    value(doc, val, x, r1 + 8, w5, {
      bold: i === 4,
      align: "right",
      size: 8,
    });
  });

  const r2 = r1 + ROW_H;
  hLine(doc, M, r2, W);
  const w6 = W / 6;
  const row2: [string, string, boolean?][] = [
    ["VALOR FRETE", fmtBrMoney(data.freight ?? 0)],
    ["VALOR SEGURO", fmtBrMoney(data.insurance ?? 0)],
    ["VALOR DESCONTO", fmtBrMoney(data.discount ?? 0)],
    ["OUTRAS DESP", fmtBrMoney(data.otherExpenses ?? 0)],
    ["VALOR IPI", fmtBrMoney(data.ipi ?? 0)],
    ["TOTAL DA NOTA", fmtBrMoney(data.totalNfe), true],
  ];
  row2.forEach(([lbl, val, bold], i) => {
    const x = M + i * w6;
    if (i > 0) vLine(doc, x, r2, ROW_H);
    label(doc, lbl, x, r2, w6);
    value(doc, val, x, r2 + 8, w6, {
      bold: Boolean(bold),
      align: "right",
      size: 8,
    });
  });

  return y + blockH;
}

function drawTransportador(
  doc: PDFKit.PDFDocument,
  data: DanfeNfeData,
  y: number,
): number {
  const blockH = TITLE_H + ROW_H * 3;

  const freteLabels: Record<string, string> = {
    "0": "0-Remetente",
    "1": "1-Destinatário",
    "2": "2-Terceiros",
    "3": "3-Próprio remetente",
    "4": "4-Próprio destinatário",
    "9": "9-Sem frete",
  };
  const frete =
    freteLabels[data.freightMode ?? "9"] ?? data.freightMode ?? "9-Sem frete";

  strokeRect(doc, M, y, W, blockH);
  sectionTitle(doc, "TRANSPORTADOR / VOLUMES TRANSPORTADOS", M, y, W);
  hLine(doc, M, y + TITLE_H, W);

  // Linha 1: Nome | Frete | ANTT | Placa | UF | CNPJ
  const r1 = y + TITLE_H;
  const nameW = W * 0.4;
  const freteW = W * 0.14;
  const anttW = W * 0.12;
  const placaW = W * 0.12;
  const uf1W = W * 0.06;
  const cnpjW = W - nameW - freteW - anttW - placaW - uf1W;
  let x = M;
  const row1: [string, string, number][] = [
    ["NOME / RAZÃO SOCIAL", data.transporterName ?? "", nameW],
    ["FRETE POR CONTA", frete, freteW],
    ["CÓDIGO ANTT", data.anttCode ?? "", anttW],
    ["PLACA DO VEÍC", data.vehiclePlate ?? "", placaW],
    ["UF", data.vehicleState ?? "", uf1W],
    ["CNPJ / CPF", fmtDoc(data.transporterDocument ?? ""), cnpjW],
  ];
  for (const [lbl, val, ww] of row1) {
    if (x > M) vLine(doc, x, r1, ROW_H);
    label(doc, lbl, x, r1, ww);
    value(doc, val, x, r1 + 8, ww, {
      align: lbl === "UF" ? "center" : "left",
      size: 7,
    });
    x += ww;
  }

  // Linha 2: Endereço | Município | UF | IE
  const r2 = r1 + ROW_H;
  hLine(doc, M, r2, W);
  const endW = W * 0.5;
  const munW = W * 0.28;
  const uf2W = W * 0.06;
  const ieW = W - endW - munW - uf2W;
  x = M;
  const row2: [string, string, number][] = [
    ["ENDEREÇO", data.transporterAddress ?? "", endW],
    ["MUNICÍPIO", data.transporterCity ?? "", munW],
    ["UF", data.transporterState ?? "", uf2W],
    ["INSCRIÇÃO ESTADUAL", fmtIe(data.transporterIe), ieW],
  ];
  for (const [lbl, val, ww] of row2) {
    if (x > M) vLine(doc, x, r2, ROW_H);
    label(doc, lbl, x, r2, ww);
    value(doc, val, x, r2 + 8, ww, {
      align: lbl === "UF" ? "center" : "left",
    });
    x += ww;
  }

  // Linha 3: Quantidade | Espécie | Marca | Numeração | Peso Bruto | Peso Líquido
  const r3 = r2 + ROW_H;
  hLine(doc, M, r3, W);
  const qW = W * 0.14;
  const espW = W * 0.16;
  const marcaW = W * 0.16;
  const numW = W * 0.16;
  const pbW = W * 0.19;
  const plW = W - qW - espW - marcaW - numW - pbW;
  x = M;
  const vols: [string, string, number][] = [
    [
      "QUANTIDADE",
      data.volumeQty != null ? String(data.volumeQty) : "",
      qW,
    ],
    ["ESPÉCIE", data.volumeSpecies ?? "", espW],
    ["MARCA", data.volumeBrand ?? "", marcaW],
    ["NUMERAÇÃO", data.volumeNumbering ?? "", numW],
    [
      "PESO BRUTO",
      data.grossWeight != null ? fmtWeight(data.grossWeight) : "",
      pbW,
    ],
    [
      "PESO LÍQUIDO",
      data.netWeight != null ? fmtWeight(data.netWeight) : "",
      plW,
    ],
  ];
  for (const [lbl, val, ww] of vols) {
    if (x > M) vLine(doc, x, r3, ROW_H);
    label(doc, lbl, x, r3, ww);
    value(doc, val, x, r3 + 8, ww, { align: "right" });
    x += ww;
  }

  return y + blockH;
}

/** Larguras das colunas de itens (~medidas UniDANFE sobre conteúdo 551pt). */
const ITEM_COLS: {
  key: string;
  label: string;
  w: number;
  align?: "left" | "right" | "center";
}[] = [
  { key: "code", label: "CÓDIGO\nPRODUTO", w: 33.4 },
  { key: "desc", label: "DESCRIÇÃO DO PRODUTO / SERVIÇO", w: 256 },
  { key: "ncm", label: "NCM/SH", w: 37.7, align: "center" },
  { key: "csosn", label: "CSOSN", w: 24.4, align: "center" },
  { key: "cfop", label: "CFOP", w: 21.3, align: "center" },
  { key: "un", label: "UNID", w: 20.1, align: "center" },
  { key: "qty", label: "QUANT", w: 25.9, align: "right" },
  { key: "vu", label: "VALOR\nUNIT", w: 25.3, align: "right" },
  { key: "vt", label: "VALOR\nTOTAL", w: 33.7, align: "right" },
  { key: "bc", label: "B.CÁLC\nICMS", w: 26.3, align: "right" },
  { key: "vicms", label: "VALOR\nICMS", w: 25.3, align: "right" },
  {
    key: "aliq",
    label: "ALÍQ.\nICMS",
    w: W - (33.4 + 256 + 37.7 + 24.4 + 21.3 + 20.1 + 25.9 + 25.3 + 33.7 + 26.3 + 25.3),
    align: "right",
  },
];

function drawItemsOuter(
  doc: PDFKit.PDFDocument,
  y: number,
  boxH: number,
): void {
  strokeRect(doc, M, y, W, boxH);
  sectionTitle(doc, "DADOS DOS PRODUTOS / SERVIÇOS", M, y, W);
  hLine(doc, M, y + TITLE_H, W);

  const colH = 16;
  let x = M;
  for (let i = 0; i < ITEM_COLS.length; i++) {
    const c = ITEM_COLS[i]!;
    if (i > 0) vLine(doc, x, y + TITLE_H, boxH - TITLE_H);
    doc
      .font("Helvetica")
      .fontSize(4.2)
      .fillColor("#222")
      .text(c.label, x + 0.5, y + TITLE_H + 2, {
        width: c.w - 1,
        align: "center",
        lineGap: -1,
      });
    x += c.w;
  }
  doc.fillColor("#000");
  hLine(doc, M, y + TITLE_H + colH, W);
}

function itemRowHeight(it: DanfeNfeData["items"][number]): number {
  return it.barcode ? ITEM_ROW_H_BARCODE : ITEM_ROW_H;
}

function drawItemRow(
  doc: PDFKit.PDFDocument,
  it: DanfeNfeData["items"][number],
  y: number,
  drawBottom: boolean,
): number {
  const h = itemRowHeight(it);
  if (drawBottom) hLine(doc, M, y + h, W);
  const cells = [
    it.productCode ?? String(it.lineNumber),
    it.description,
    it.ncm ?? "",
    it.csosn ?? "",
    it.cfop ?? "",
    it.unit ?? "",
    fmtQty(it.quantity),
    fmtBrMoney(it.unitPrice),
    fmtBrMoney(it.totalPrice),
    fmtBrMoney(it.icmsBase ?? 0),
    fmtBrMoney(it.icmsValue ?? 0),
    it.icmsRate != null && it.icmsRate !== 0 ? fmtBrMoney(it.icmsRate) : "",
  ];
  let x = M;
  for (let i = 0; i < ITEM_COLS.length; i++) {
    const c = ITEM_COLS[i]!;
    if (i === 1) {
      doc
        .font("Helvetica")
        .fontSize(6.5)
        .text(cells[i] ?? "", x + 2, y + 2.5, {
          width: c.w - 4,
          lineBreak: false,
          ellipsis: true,
        });
      if (it.barcode) {
        doc
          .fontSize(5)
          .fillColor("#333")
          .text(`Cód. Barras: ${it.barcode}`, x + 2, y + 11.5, {
            width: c.w - 4,
            lineBreak: false,
          });
        doc.fillColor("#000");
      }
    } else {
      doc
        .font("Helvetica")
        .fontSize(6.5)
        .text(cells[i] ?? "", x + 1, y + (h - 7) / 2, {
          width: c.w - 2,
          align: c.align ?? "left",
          lineBreak: false,
          ellipsis: true,
        });
    }
    x += c.w;
  }
  return y + h;
}

function drawAdicionais(
  doc: PDFKit.PDFDocument,
  data: DanfeNfeData,
  y: number,
  h = 88,
): number {
  const leftW = W * 0.62;
  const rightW = W - leftW;
  strokeRect(doc, M, y, W, h);
  sectionTitle(doc, "DADOS ADICIONAIS", M, y, W);
  hLine(doc, M, y + TITLE_H, W);
  vLine(doc, M + leftW, y + TITLE_H, h - TITLE_H);

  label(doc, "INFORMAÇÕES COMPLEMENTARES", M, y + TITLE_H, leftW);
  doc
    .font("Helvetica")
    .fontSize(6)
    .text(data.additionalInfo ?? "", M + PAD, y + TITLE_H + 10, {
      width: leftW - PAD * 2,
      height: h - TITLE_H - 14,
    });

  label(doc, "RESERVADO AO FISCO", M + leftW, y + TITLE_H, rightW);
  return y + h;
}

export function danfePdfFilename(
  invoiceId: string,
  number?: number | null,
): string {
  const suffix = number != null ? String(number) : invoiceId.slice(0, 8);
  return `danfe-${suffix}.pdf`;
}

export async function buildDanfePdf(data: DanfeNfeData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  let y = M;

  y = await drawHeader(doc, data, y);
  // UniDANFE: Natureza+Protocolo → IE/CNPJ (ordem invertida vs. versão anterior)
  y = drawNatureProtocol(doc, data, y);
  y = drawIeCnpjRow(doc, data, y);
  y = drawDestinatario(doc, data, y);
  y = drawImpostos(doc, data, y);
  y = drawTransportador(doc, data, y);

  const adicionaisH = 88;
  const footerReserve = CANHOTO_H + 28 + adicionaisH + 14;
  const itemsTop = y;
  const itemsBoxH = Math.max(
    TITLE_H + 16 + ITEM_ROW_H * 4,
    PAGE_H - M - footerReserve - itemsTop,
  );
  drawItemsOuter(doc, itemsTop, itemsBoxH);

  let itemY = itemsTop + TITLE_H + 16;
  const itemsBottom = itemsTop + itemsBoxH;

  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i]!;
    const need = itemRowHeight(it);
    if (itemY + need > itemsBottom - 2) {
      // Página extra: nova grade de itens
      doc.addPage();
      y = M;
      const boxH = PAGE_H - M * 2 - CANHOTO_H - 40;
      drawItemsOuter(doc, y, boxH);
      itemY = y + TITLE_H + 16;
      const pageBottom = y + boxH;
      itemY = drawItemRow(doc, it, itemY, itemY + need < pageBottom - 2);
      continue;
    }
    itemY = drawItemRow(doc, it, itemY, itemY + need < itemsBottom - 2);
  }

  y = itemsTop + itemsBoxH;
  y = drawAdicionais(doc, data, y, adicionaisH);

  // Rodapé estilo UniDANFE (marca + data)
  doc
    .font("Helvetica")
    .fontSize(5)
    .fillColor("#444")
    .text("PedixPro | NF-e", M, y + 3, { width: W * 0.35, align: "left" });
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    M + W * 0.35,
    y + 3,
    { width: W * 0.65, align: "right" },
  );
  doc.fillColor("#000");

  y = drawCutLine(doc, y + 10);
  drawCanhoto(doc, data, y);

  doc.end();
  return done;
}
