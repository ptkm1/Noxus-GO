import { prisma } from "../db.js";
import { parseInboundNfeXml } from "../fiscal/nfe-xml.js";
import { applyInboundInvoiceStock, reverseInboundInvoiceStock } from "./stock.js";

export async function importInboundNfeXml(
  organizationId: string,
  xml: string,
  productMappings?: Record<number, string>,
) {
  const parsed = parseInboundNfeXml(xml);
  if (!parsed) return { ok: false as const, error: "XML inválido ou não reconhecido" };

  const existing = await prisma.fiscalInvoice.findUnique({
    where: { accessKey: parsed.accessKey },
  });
  if (existing) return { ok: false as const, error: "NF-e já importada" };

  const supplier = await prisma.supplier.upsert({
    where: {
      organizationId_document: {
        organizationId,
        document: parsed.issuer.cnpj,
      },
    },
    create: {
      organizationId,
      name: parsed.issuer.name,
      document: parsed.issuer.cnpj,
      stateRegistration: parsed.issuer.ie,
      street: parsed.issuer.street,
      city: parsed.issuer.city,
      state: parsed.issuer.state,
      zipCode: parsed.issuer.zipCode,
    },
    update: {
      name: parsed.issuer.name,
      stateRegistration: parsed.issuer.ie,
      street: parsed.issuer.street,
      city: parsed.issuer.city,
      state: parsed.issuer.state,
      zipCode: parsed.issuer.zipCode,
    },
  });

  const invoice = await prisma.fiscalInvoice.create({
    data: {
      organizationId,
      direction: "INBOUND",
      status: "IMPORTED",
      supplierId: supplier.id,
      accessKey: parsed.accessKey,
      number: parsed.number,
      series: parsed.series,
      totalAmount: parsed.totalAmount,
      issuedAt: parsed.issuedAt,
      xmlAuthorized: xml,
      issuerSnapshot: parsed.issuer,
      items: {
        create: parsed.items.map((item) => ({
          lineNumber: item.lineNumber,
          description: item.description,
          ncm: item.ncm,
          cfop: item.cfop,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          supplierProductCode: item.supplierProductCode,
          productId: productMappings?.[item.lineNumber] ?? null,
        })),
      },
    },
    include: { items: true, supplier: true },
  });

  return { ok: true as const, invoice };
}

export async function confirmInboundImport(
  organizationId: string,
  invoiceId: string,
  productMappings: Record<string, string>,
  userId?: string,
) {
  const config = await prisma.organizationFiscalConfig.findUnique({ where: { organizationId } });
  const invoice = await prisma.fiscalInvoice.findFirst({
    where: { id: invoiceId, organizationId, direction: "INBOUND" },
    include: { items: true },
  });
  if (!invoice) return { ok: false as const, error: "Nota não encontrada" };
  if (invoice.stockApplied) return { ok: false as const, error: "Estoque já aplicado" };

  await prisma.$transaction(async (tx) => {
    for (const item of invoice.items) {
      const productId = productMappings[item.id] ?? item.productId;
      if (!productId) continue;
      await tx.fiscalInvoiceItem.update({
        where: { id: item.id },
        data: { productId },
      });
    }
  });

  const refreshed = await prisma.fiscalInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true },
  });

  if (config?.autoStockOnInboundInvoice) {
    const stockItems = refreshed.items
      .filter((i) => i.productId)
      .map((i) => ({ productId: i.productId!, quantity: Number(i.quantity) }));
    if (stockItems.length) {
      await applyInboundInvoiceStock(organizationId, invoiceId, stockItems, userId);
      await prisma.fiscalInvoice.update({
        where: { id: invoiceId },
        data: { stockApplied: true },
      });
    }
  }

  return { ok: true as const, invoice: refreshed, stockApplied: config?.autoStockOnInboundInvoice ?? false };
}

export async function cancelInboundInvoice(
  organizationId: string,
  invoiceId: string,
  justification: string,
  userId?: string,
) {
  const invoice = await prisma.fiscalInvoice.findFirst({
    where: { id: invoiceId, organizationId, direction: "INBOUND" },
    include: { items: true },
  });
  if (!invoice) return { ok: false as const, error: "Nota não encontrada" };
  if (invoice.status === "CANCELLED") {
    return { ok: false as const, error: "Nota já cancelada" };
  }
  if (invoice.status !== "IMPORTED" && invoice.status !== "AUTHORIZED") {
    return { ok: false as const, error: "Status inválido para cancelamento" };
  }
  if (justification.trim().length < 15) {
    return { ok: false as const, error: "Justificativa deve ter no mínimo 15 caracteres" };
  }

  if (invoice.stockApplied) {
    const stockItems = invoice.items
      .filter((i) => i.productId)
      .map((i) => ({ productId: i.productId!, quantity: Number(i.quantity) }));
    if (stockItems.length) {
      try {
        await reverseInboundInvoiceStock(organizationId, invoiceId, stockItems, userId);
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : "Falha ao estornar estoque",
        };
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.fiscalInvoiceEvent.create({
      data: {
        fiscalInvoiceId: invoice.id,
        eventType: "NFeCancelamentoLocal",
        requestPayload: justification.trim(),
        responsePayload: "Cancelamento registrado localmente (NF-e de terceiros)",
        success: true,
      },
    });
    return tx.fiscalInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "CANCELLED",
        rejectionReason: justification.trim(),
        stockApplied: false,
      },
      include: { items: true, supplier: true },
    });
  });

  return { ok: true as const, invoice: updated };
}

/** MVP: lista notas pendentes simuladas até integração DF-e real. */
export async function listInboundPending(organizationId: string) {
  return prisma.fiscalInvoice.findMany({
    where: {
      organizationId,
      direction: "INBOUND",
      status: { in: ["DRAFT", "IMPORTED"] },
    },
    orderBy: { createdAt: "desc" },
    include: { supplier: true, items: true },
  });
}
