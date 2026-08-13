import {
  formatRomaneioNumber,
  groupOrdersByPaymentCondition,
  paymentConditionLabel,
  sumOrderTotals,
  uniqueIdsPreserveOrder,
} from "@pedidos/shared";
import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";
import {
  COLORS,
  PAGE,
  drawHeader,
  drawInfoBar,
  drawTableFooter,
  drawTableHeader,
  drawTableRow,
  ensureSpace,
  money,
  orderCode,
  shortDateTime,
  withPdfDoc,
  type PdfTable,
} from "./pdf-common.js";

export type RouteRomaneioPdfInput = {
  organizationId: string;
  orderIds: string[];
  routeName?: string | null;
  driverName?: string | null;
};

const TABLE: PdfTable = {
  columns: [
    { key: "code", label: "Pedido", width: 58 },
    { key: "customer", label: "Cliente", width: 160 },
    { key: "city", label: "Cidade", width: 90 },
    { key: "pay", label: "Condição de pagamento", width: 129 },
    { key: "total", label: "Valor", width: 110, align: "right" },
  ],
  rowHeight: 22,
};

function customerLabel(c: {
  name: string;
  tradeName?: string | null;
  legalName?: string | null;
} | null): string {
  if (!c) return "—";
  return c.tradeName?.trim() || c.legalName?.trim() || c.name.trim() || "—";
}

function drawSignatureBlock(doc: PDFKit.PDFDocument) {
  doc
    .fillColor(COLORS.text)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("CONFERÊNCIA E ASSINATURA", PAGE.left, doc.y, {
      width: PAGE.width,
    });
  doc.moveDown(0.4);

  const colW = (PAGE.width - 16) / 2;
  const startY = doc.y;
  const boxH = 118;

  function personBox(x: number, title: string) {
    doc
      .roundedRect(x, startY, colW, boxH, 3)
      .fillAndStroke("#f8fafc", COLORS.border);
    doc
      .fillColor(COLORS.text)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(title, x + 10, startY + 10, { width: colW - 20 });
    doc
      .fillColor(COLORS.muted)
      .fontSize(8)
      .font("Helvetica")
      .text("Nome:", x + 10, startY + 36, { width: 40, lineBreak: false });
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.6)
      .moveTo(x + 48, startY + 46)
      .lineTo(x + colW - 12, startY + 46)
      .stroke();
    doc
      .fillColor(COLORS.muted)
      .fontSize(8)
      .font("Helvetica")
      .text("Assinatura:", x + 10, startY + 72, {
        width: 58,
        lineBreak: false,
      });
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.6)
      .moveTo(x + 68, startY + 82)
      .lineTo(x + colW - 12, startY + 82)
      .stroke();
  }

  personBox(PAGE.left, "MOTORISTA");
  personBox(PAGE.left + colW + 16, "CONFERENTE");
  doc.y = startY + boxH + 8;
  doc.font("Helvetica").fillColor(COLORS.text);
}

export async function buildRouteRomaneioPdf(
  input: RouteRomaneioPdfInput,
): Promise<Buffer> {
  const orderIds = uniqueIdsPreserveOrder(input.orderIds);
  if (orderIds.length === 0) {
    throw Object.assign(new Error("Selecione ao menos um pedido"), {
      code: "ROMANEIO_EMPTY",
      statusCode: 400,
    });
  }

  const [org, rows] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { name: true, displayName: true },
    }),
    prisma.order.findMany({
      where: {
        organizationId: input.organizationId,
        id: { in: orderIds },
      },
      include: {
        customer: {
          select: {
            name: true,
            tradeName: true,
            legalName: true,
            city: true,
          },
        },
        paymentCondition: {
          select: { id: true, name: true, days: true, sortOrder: true },
        },
      },
    }),
  ]);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const orders = orderIds
    .map((id) => byId.get(id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  if (orders.length === 0) {
    throw Object.assign(new Error("Nenhum pedido encontrado para o romaneio"), {
      code: "ROMANEIO_NOT_FOUND",
      statusCode: 400,
    });
  }

  const generatedAt = new Date();
  const number = formatRomaneioNumber(generatedAt);
  const orgName = org?.displayName?.trim() || org?.name || undefined;
  const routeName = input.routeName?.trim() || "";
  const driverName = input.driverName?.trim() || "";

  const totals = orders.map((o) => ({
    id: o.id,
    totalAmount: decToNum(o.totalAmount),
    paymentCondition: o.paymentCondition,
  }));
  const grandTotal = sumOrderTotals(totals);
  const groups = groupOrdersByPaymentCondition(totals);

  const infoLines: Array<{ label: string; value: string }> = [
    { label: "Número:", value: number },
    { label: "Data de geração:", value: shortDateTime(generatedAt) },
  ];
  if (routeName) infoLines.push({ label: "Rota:", value: routeName });
  if (driverName) infoLines.push({ label: "Motorista:", value: driverName });

  function paintHeader(doc: PDFKit.PDFDocument) {
    drawHeader(doc, "ROMANEIO DE ROTA", orgName);
    drawInfoBar(doc, infoLines);
  }

  return withPdfDoc((doc) => {
    paintHeader(doc);
    drawTableHeader(doc, TABLE);

    orders.forEach((o, index) => {
      drawTableRow(
        doc,
        TABLE,
        {
          code: orderCode(o),
          customer: customerLabel(o.customer),
          city: o.customer?.city?.trim() || "—",
          pay: paymentConditionLabel(o.paymentCondition),
          total: money(decToNum(o.totalAmount)),
        },
        {
          index,
          onNewPage: () => paintHeader(doc),
        },
      );
    });

    drawTableFooter(
      doc,
      `Quantidade de pedidos: ${orders.length}`,
      `Valor total: ${money(grandTotal)}`,
    );

    const summaryH = 28 + groups.length * 14 + 20;
    if (ensureSpace(doc, summaryH + 176)) {
      paintHeader(doc);
    }

    doc
      .fillColor(COLORS.text)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("RESUMO DO ROMANEIO", PAGE.left, doc.y, { width: PAGE.width });
    doc.moveDown(0.35);

    const boxTop = doc.y;
    const boxH = 16 + (2 + groups.length) * 14;
    doc
      .roundedRect(PAGE.left, boxTop, PAGE.width, boxH, 3)
      .fillAndStroke("#f8fafc", COLORS.border);

    let y = boxTop + 8;
    const lines = [
      `Quantidade de pedidos: ${orders.length}`,
      `Valor total dos pedidos: ${money(grandTotal)}`,
      ...groups.map((g) => `${g.label}: ${money(g.total)}`),
    ];
    for (const line of lines) {
      doc
        .fillColor(COLORS.text)
        .fontSize(9)
        .font("Helvetica")
        .text(line, PAGE.left + 10, y, { width: PAGE.width - 20 });
      y += 14;
    }
    doc.y = boxTop + boxH + 14;
    doc.font("Helvetica");

    if (ensureSpace(doc, 168)) {
      paintHeader(doc);
    }
    drawSignatureBlock(doc);
  });
}
