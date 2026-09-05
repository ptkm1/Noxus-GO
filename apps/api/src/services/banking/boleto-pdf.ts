import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";

export type InternalBoletoPdfInput = {
  organizationName: string;
  organizationDocument?: string | null;
  payerName: string;
  payerDocument: string;
  amount: number;
  dueDate: Date;
  digitableLine?: string | null;
  barcode?: string | null;
  nossoNumero?: string | null;
  instructions?: string | null;
  installmentIndex?: number | null;
  installmentTotal?: number | null;
  orderLabel?: string | null;
};

function fmtBrl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

/**
 * PDF interno de boleto (fallback quando o banco não fornece PDF).
 * Não substitui o layout oficial CIP — serve linha digitável + dados para pagamento.
 */
export async function generateInternalBoletoPdf(
  input: InternalBoletoPdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    paint(doc, input);
    doc.end();
  });
}

function paint(doc: PDFKit.PDFDocument, input: InternalBoletoPdfInput) {
  doc
    .fontSize(16)
    .fillColor("#111")
    .text("Boleto bancário", { align: "left" });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .fillColor("#555")
    .text("Documento gerado pelo Pedix Pro (2ª via / fallback interno).");

  doc.moveDown(1);
  section(doc, "Cedente");
  doc.fontSize(11).fillColor("#111").text(input.organizationName);
  if (input.organizationDocument) {
    doc
      .fontSize(10)
      .fillColor("#444")
      .text(`CNPJ/CPF: ${input.organizationDocument}`);
  }

  doc.moveDown(0.8);
  section(doc, "Sacado");
  doc.fontSize(11).fillColor("#111").text(input.payerName);
  doc.fontSize(10).fillColor("#444").text(`CPF/CNPJ: ${input.payerDocument}`);

  doc.moveDown(0.8);
  section(doc, "Título");
  const parcela =
    input.installmentIndex != null && input.installmentTotal != null
      ? `Parcela ${input.installmentIndex}/${input.installmentTotal}`
      : null;
  const rows: Array<[string, string]> = [
    ["Valor", fmtBrl(input.amount)],
    ["Vencimento", fmtDate(input.dueDate)],
  ];
  if (input.nossoNumero) rows.push(["Nosso número", input.nossoNumero]);
  if (parcela) rows.push(["Parcela", parcela]);
  if (input.orderLabel) rows.push(["Pedido", input.orderLabel]);
  for (const [k, v] of rows) {
    doc.fontSize(10).fillColor("#666").text(`${k}: `, { continued: true });
    doc.fillColor("#111").text(v);
  }

  if (input.digitableLine) {
    doc.moveDown(1);
    section(doc, "Linha digitável");
    doc
      .font("Courier")
      .fontSize(12)
      .fillColor("#111")
      .text(formatDigitable(input.digitableLine), { align: "left" });
    doc.font("Helvetica");
  }

  if (input.barcode) {
    doc.moveDown(0.6);
    section(doc, "Código de barras");
    doc
      .font("Courier")
      .fontSize(10)
      .fillColor("#111")
      .text(input.barcode.replace(/\D/g, ""));
    doc.font("Helvetica");
  }

  if (input.instructions) {
    doc.moveDown(0.8);
    section(doc, "Instruções");
    doc.fontSize(10).fillColor("#333").text(input.instructions);
  }

  doc.moveDown(2);
  doc
    .fontSize(8)
    .fillColor("#888")
    .text(
      "Este PDF é informativo. Em caso de divergência, prevalece o título registrado no banco.",
    );
}

function section(doc: PDFKit.PDFDocument, title: string) {
  doc.fontSize(9).fillColor("#888").text(title.toUpperCase());
  doc.moveDown(0.2);
}

function formatDigitable(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length < 47) return raw;
  // 5 campos clássicos
  return [
    d.slice(0, 5),
    d.slice(5, 10),
    d.slice(10, 15),
    d.slice(15, 21),
    d.slice(21, 32),
    d.slice(32, 33),
    d.slice(33),
  ].join(" ");
}
