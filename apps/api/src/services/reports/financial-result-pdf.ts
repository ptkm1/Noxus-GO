import { prisma } from "../../db.js";
import {
  buildCriteriaFooter,
  buildFinancialResultReport,
} from "../financial-result-report.js";
import {
  drawEmptyState,
  drawHeader,
  drawInfoBar,
  drawTableFooter,
  drawTableHeader,
  drawTableRow,
  money,
  PAGE,
  shortDateTime,
  withPdfDoc,
  type PdfTable,
} from "./pdf-common.js";

export type FinancialResultPdfFilters = {
  organizationId: string;
  from?: string;
  to?: string;
  sellerId?: string;
  sellerIds?: string[];
  includeFixedCosts?: boolean;
};

const ORDER_TABLE: PdfTable = {
  columns: [
    { key: "order", label: "Pedido", width: 52 },
    { key: "date", label: "Data", width: 78 },
    { key: "customer", label: "Cliente", width: 100 },
    { key: "revenue", label: "Venda", width: 68, align: "right" },
    { key: "cost", label: "Custo", width: 68, align: "right" },
    { key: "commission", label: "Comissão", width: 68, align: "right" },
    { key: "profit", label: "Lucro", width: 68, align: "right" },
    { key: "margin", label: "Margem", width: 45, align: "right" },
  ],
  rowHeight: 18,
};

function pct(n: number): string {
  return `${n.toFixed(1).replace(".", ",")}%`;
}

export async function buildFinancialResultPdf(
  filters: FinancialResultPdfFilters,
): Promise<Buffer> {
  const [org, report] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: filters.organizationId },
      select: { name: true, displayName: true },
    }),
    buildFinancialResultReport({
      organizationId: filters.organizationId,
      from: filters.from,
      to: filters.to,
      sellerId: filters.sellerId,
      sellerIds: filters.sellerIds,
      includeFixedCosts: filters.includeFixedCosts,
    }),
  ]);

  const orgName = org?.displayName || org?.name || "";
  const generatedAt = new Date().toLocaleString("pt-BR");
  const periodLabel = `${shortDateTime(new Date(report.period.from))} — ${shortDateTime(new Date(report.period.to))}`;

  return withPdfDoc((doc) => {
    drawHeader(
      doc,
      "Resultado financeiro",
      orgName,
      `Gerado em ${generatedAt}`,
    );

    const kpiLines: Array<{ label: string; value: string }> = [
      { label: "Período:", value: periodLabel },
      { label: "Pedidos:", value: String(report.totals.orderCount) },
      { label: "Faturamento:", value: money(report.totals.revenue) },
      { label: "Ticket médio:", value: money(report.totals.avgTicket) },
      { label: "Custo produtos:", value: money(report.totals.productCost) },
      { label: "Comissões:", value: money(report.totals.commission) },
      {
        label: "Lucro bruto:",
        value: `${money(report.totals.grossProfit)} (${pct(report.totals.grossMarginPct)})`,
      },
    ];

    if (report.includeFixedCosts && report.totals.fixedCosts != null) {
      kpiLines.push({
        label: "Custos fixos:",
        value: money(report.totals.fixedCosts),
      });
      if (report.totals.finalProfit != null) {
        kpiLines.push({
          label: "Lucro final:",
          value: `${money(report.totals.finalProfit)} (${pct(report.totals.finalMarginPct ?? 0)})`,
        });
      }
    }

    drawInfoBar(doc, kpiLines);

    if (report.byOrder.length === 0) {
      drawEmptyState(doc, "Nenhum pedido confirmado no período.");
    } else {
      drawTableHeader(doc, ORDER_TABLE);
      report.byOrder.forEach((row, index) => {
        drawTableRow(
          doc,
          ORDER_TABLE,
          {
            order: row.orderCode,
            date: shortDateTime(new Date(row.createdAt)),
            customer: row.customerName.slice(0, 28),
            revenue: money(row.revenue),
            cost: money(row.productCost),
            commission: money(row.commission),
            profit: money(row.profit),
            margin: pct(row.marginPct),
          },
          {
            index,
            onNewPage: () => drawTableHeader(doc, ORDER_TABLE),
          },
        );
      });

      drawTableFooter(
        doc,
        `${report.byOrder.length} pedido(s)`,
        `Lucro bruto: ${money(report.totals.grossProfit)}`,
      );
    }

    doc.moveDown(0.8);
    doc
      .fillColor("#64748b")
      .fontSize(7)
      .font("Helvetica")
      .text(buildCriteriaFooter(report.includeFixedCosts), PAGE.left, doc.y, {
        width: PAGE.width,
        align: "left",
      });
  });
}
