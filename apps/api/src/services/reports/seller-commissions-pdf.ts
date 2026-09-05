import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";
import { sellerCommissionPeriod } from "../seller-commission-report.js";
import { drawEmptyState, drawHeader, drawTableFooter, drawTableHeader, drawTableRow, money, orderCode, shortDateTime, type PdfTable, withPdfDoc } from "./pdf-common.js";

const TABLE: PdfTable = {
  columns: [
    { key: "order", label: "Pedido", width: 64 }, { key: "date", label: "Data", width: 74 },
    { key: "customer", label: "Cliente", width: 150 }, { key: "sale", label: "Venda", width: 80, align: "right" },
    { key: "pct", label: "%", width: 50, align: "right" }, { key: "commission", label: "Comissão", width: 88, align: "right" },
  ], rowHeight: 22,
};

export async function buildSellerCommissionsPdf(params: { organizationId: string; sellerId: string; from?: string; to?: string }) {
  const period = sellerCommissionPeriod(params.from, params.to);
  const [org, seller, orders] = await Promise.all([
    prisma.organization.findUnique({ where: { id: params.organizationId }, select: { name: true, displayName: true } }),
    prisma.seller.findFirst({ where: { id: params.sellerId, organizationId: params.organizationId }, select: { user: { select: { name: true } } } }),
    prisma.order.findMany({ where: { organizationId: params.organizationId, sellerId: params.sellerId, status: "CONFIRMED", createdAt: { gte: period.from, lte: period.to } }, orderBy: { createdAt: "desc" }, select: { id: true, orderNumber: true, createdAt: true, totalAmount: true, customer: { select: { name: true } }, items: { select: { commissionAmount: true } } } }),
  ]);
  return withPdfDoc((doc) => {
    drawHeader(doc, "Minhas comissões", org?.displayName || org?.name || "", `${seller?.user.name ?? "Vendedor"} · ${period.from.toLocaleDateString("pt-BR")} a ${period.to.toLocaleDateString("pt-BR")}`);
    if (!orders.length) { drawEmptyState(doc, "Nenhum pedido confirmado no período."); return; }
    drawTableHeader(doc, TABLE);
    let sales = 0; let commissions = 0;
    orders.forEach((order, index) => {
      const sale = decToNum(order.totalAmount);
      const commission = order.items.reduce((sum, item) => sum + decToNum(item.commissionAmount ?? 0), 0);
      sales += sale; commissions += commission;
      drawTableRow(doc, TABLE, { order: orderCode(order), date: shortDateTime(order.createdAt), customer: order.customer?.name ?? "—", sale: money(sale), pct: `${sale > 0 ? ((commission / sale) * 100).toFixed(2) : "0.00"}%`, commission: money(commission) }, { index, onNewPage: () => drawHeader(doc, "Minhas comissões (cont.)", org?.displayName || org?.name || "") });
    });
    drawTableFooter(doc, `Total vendido: ${money(sales)}`, `Comissão: ${money(commissions)}`);
  });
}
