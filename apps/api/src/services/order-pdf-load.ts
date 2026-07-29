import type { FastifyReply } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import {
  buildOrderPdf,
  orderPdfFilename,
  type OrderPdfCustomer,
  type OrderPdfInput,
} from "./order-pdf.js";
import {
  buildOrderPdf80mm,
  orderPdf80mmFilename,
} from "./order-pdf-80mm.js";
import { resolveOrderPdfLogo } from "./order-pdf-logo.js";

const orderPdfInclude = {
  seller: { include: { user: { select: { name: true, email: true } } } },
  customer: {
    select: {
      name: true,
      email: true,
      phone: true,
      legalName: true,
      tradeName: true,
      documentType: true,
      cnpj: true,
      cpf: true,
      street: true,
      number: true,
      neighborhood: true,
      city: true,
      state: true,
      cep: true,
      addressNote: true,
    },
  },
  items: { include: { product: { select: { sku: true } } } },
  organization: { select: { name: true, displayName: true, logoUrl: true } },
} as const;

export async function loadOrderForPdf(where: Prisma.OrderWhereInput) {
  return prisma.order.findFirst({
    where,
    include: orderPdfInclude,
  });
}

function toCustomer(
  customer: NonNullable<Awaited<ReturnType<typeof loadOrderForPdf>>>["customer"],
): OrderPdfCustomer | null {
  if (!customer) return null;
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    legalName: customer.legalName,
    tradeName: customer.tradeName,
    documentType: customer.documentType,
    cnpj: customer.cnpj,
    cpf: customer.cpf,
    street: customer.street,
    number: customer.number,
    neighborhood: customer.neighborhood,
    city: customer.city,
    state: customer.state,
    cep: customer.cep,
    addressNote: customer.addressNote,
  };
}

async function toPdfInput(
  order: NonNullable<Awaited<ReturnType<typeof loadOrderForPdf>>>,
): Promise<OrderPdfInput> {
  const logo = await resolveOrderPdfLogo({
    organizationId: order.organizationId,
    logoUrl: order.organization.logoUrl,
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    comboDiscountTotal: order.comboDiscountTotal,
    notes: order.notes,
    createdAt: order.createdAt,
    organizationName: order.organization.displayName ?? order.organization.name,
    logo,
    seller: order.seller,
    customer: toCustomer(order.customer),
    items: order.items,
  };
}

export async function sendOrderPdfReply(
  reply: FastifyReply,
  order: NonNullable<Awaited<ReturnType<typeof loadOrderForPdf>>>,
) {
  const pdf = await buildOrderPdf(await toPdfInput(order));
  const filename = orderPdfFilename(order);
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `inline; filename="${filename}"`)
    .send(pdf);
}

export async function sendOrderPdf80mmReply(
  reply: FastifyReply,
  order: NonNullable<Awaited<ReturnType<typeof loadOrderForPdf>>>,
) {
  const pdf = await buildOrderPdf80mm(await toPdfInput(order));
  const filename = orderPdf80mmFilename(order);
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `inline; filename="${filename}"`)
    .send(pdf);
}
