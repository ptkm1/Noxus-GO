import type { FastifyReply } from "fastify";
import { prisma } from "../db.js";
import {
  buildOrderPdf,
  orderPdfFilename,
  type OrderPdfInput,
} from "./order-pdf.js";

const orderPdfInclude = {
  seller: { include: { user: { select: { name: true, email: true } } } },
  customer: true,
  items: { include: { product: { select: { sku: true } } } },
  organization: { select: { name: true, displayName: true } },
} as const;

export async function loadOrderForPdf(where: {
  id: string;
  organizationId: string;
  sellerId?: string;
}) {
  return prisma.order.findFirst({
    where,
    include: orderPdfInclude,
  });
}

function toPdfInput(
  order: NonNullable<Awaited<ReturnType<typeof loadOrderForPdf>>>,
): OrderPdfInput {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: order.totalAmount,
    comboDiscountTotal: order.comboDiscountTotal,
    notes: order.notes,
    createdAt: order.createdAt,
    organizationName: order.organization.displayName ?? order.organization.name,
    seller: order.seller,
    customer: order.customer,
    items: order.items,
  };
}

export async function sendOrderPdfReply(
  reply: FastifyReply,
  order: NonNullable<Awaited<ReturnType<typeof loadOrderForPdf>>>,
) {
  const pdf = await buildOrderPdf(toPdfInput(order));
  const filename = orderPdfFilename(order);
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `inline; filename="${filename}"`)
    .send(pdf);
}
