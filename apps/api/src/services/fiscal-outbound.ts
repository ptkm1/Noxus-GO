import type { OrganizationFiscalConfig } from "@prisma/client";
import { prisma } from "../db.js";
import { loadOrganizationCertificate } from "../fiscal/certificate-store.js";
import { buildCancelamentoEvento, wrapEnvEvento } from "../fiscal/nfe-event-xml.js";
import { buildSignedNfePackage, wrapEnviNFe } from "../fiscal/nfe-xml-builder.js";
import { signInfEvento, signInfNFe } from "../fiscal/nfe-signer.js";
import { authorizeNfe, sendNfeEvento } from "../fiscal/sefaz-client.js";
import {
  computeItemTaxes,
  validateCustomerFiscal,
  validateOrganizationFiscalConfig,
  validateOrganizationFiscalConfigForEmit,
  validateProductFiscal,
} from "../fiscal/validation.js";
import {
  customerFiscalDocument,
  customerFiscalRecipientSnapshot,
} from "../fiscal/customer-fiscal.js";

export async function buildOutboundInvoiceFromOrder(
  organizationId: string,
  orderId: string,
) {
  const config = await prisma.organizationFiscalConfig.findUnique({
    where: { organizationId },
  });
  const orgIssues = validateOrganizationFiscalConfigForEmit(config);
  if (orgIssues.length) {
    return { ok: false as const, issues: orgIssues };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId, status: "CONFIRMED" },
    include: {
      customer: true,
      items: { include: { product: { include: { fiscalNcm: true, outboundOperation: true } } } },
      fiscalInvoices: {
        where: { direction: "OUTBOUND", status: "AUTHORIZED" },
        take: 1,
      },
    },
  });

  if (!order) return { ok: false as const, issues: [{ code: "ORDER", message: "Pedido não encontrado ou não confirmado" }] };
  if (!order.customer) {
    return { ok: false as const, issues: [{ code: "NO_CUSTOMER", message: "Pedido sem cliente" }] };
  }
  if (order.fiscalInvoices.length > 0) {
    return { ok: false as const, issues: [{ code: "ALREADY_INVOICED", message: "Pedido já possui NF-e autorizada" }] };
  }

  const issues = [
    ...validateCustomerFiscal(order.customer),
    ...order.items.flatMap((i) => validateProductFiscal(i.product)),
  ];
  if (issues.length) return { ok: false as const, issues };

  const cfg = config!;
  const nextNumber = cfg.nfeLastNumber + 1;
  const regime = cfg.taxRegime;

  const invoiceItems = order.items.map((item, idx) => {
    const ncm = item.product.fiscalNcm;
    const cfop = item.product.outboundOperation?.cfop ?? "5102";
    const taxes = computeItemTaxes({
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      icmsRate: ncm?.icmsRate ? Number(ncm.icmsRate) : undefined,
      pisRate: ncm?.pisRate ? Number(ncm.pisRate) : undefined,
      cofinsRate: ncm?.cofinsRate ? Number(ncm.cofinsRate) : undefined,
      regime,
    });
    return {
      lineNumber: idx + 1,
      productId: item.productId,
      description: item.product.fiscalDescription ?? item.productName,
      ncm: ncm?.code ?? item.product.ncm ?? null,
      cfop,
      unit: item.product.fiscalUnit ?? item.product.purchaseUnit ?? "UN",
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: item.quantity * Number(item.unitPrice),
      taxSnapshot: taxes,
    };
  });

  const totalAmount = invoiceItems.reduce((s, i) => s + i.totalPrice, 0);

  const invoice = await prisma.$transaction(async (tx) => {
    await tx.organizationFiscalConfig.update({
      where: { organizationId },
      data: { nfeLastNumber: nextNumber },
    });

    return tx.fiscalInvoice.create({
      data: {
        organizationId,
        direction: "OUTBOUND",
        status: "DRAFT",
        orderId: order.id,
        customerId: order.customerId,
        number: nextNumber,
        series: cfg.nfeSeries,
        totalAmount,
        issuerSnapshot: buildIssuerSnapshot(cfg),
        recipientSnapshot: buildRecipientSnapshot(order.customer!),
        items: { create: invoiceItems },
      },
      include: { items: true, order: { include: { customer: true } } },
    });
  });

  return { ok: true as const, invoice };
}

export async function transmitOutboundInvoice(organizationId: string, invoiceId: string) {
  const invoice = await prisma.fiscalInvoice.findFirst({
    where: { id: invoiceId, organizationId, direction: "OUTBOUND" },
    include: { items: true, order: { include: { customer: true } } },
  });
  if (!invoice) return { ok: false as const, error: "Nota não encontrada" };
  if (invoice.status !== "DRAFT" && invoice.status !== "REJECTED") {
    return { ok: false as const, error: "Status inválido para transmissão" };
  }

  const config = await prisma.organizationFiscalConfig.findUnique({ where: { organizationId } });
  const issues = validateOrganizationFiscalConfig(config);
  if (issues.length) return { ok: false as const, error: issues.map((i) => i.message).join("; ") };

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, displayName: true },
  });
  const cert = await loadOrganizationCertificate(organizationId);
  if (!cert) return { ok: false as const, error: "Certificado A1 não disponível" };

  const recipient =
    (invoice.recipientSnapshot as ReturnType<typeof buildRecipientSnapshot> | null) ??
    (invoice.order?.customer
      ? buildRecipientSnapshot(invoice.order.customer)
      : null);
  if (!recipient) return { ok: false as const, error: "Destinatário não encontrado na nota" };

  const { accessKey, infNFeXml, issuedAt } = buildSignedNfePackage({
    config: config!,
    invoice,
    recipient,
    emitterName: org?.displayName ?? org?.name ?? "Emitente",
  });

  const signedNFe = signInfNFe(infNFeXml, cert.privateKeyPem, cert.certPem);
  const enviNFe = wrapEnviNFe(signedNFe);

  const homolog = config!.nfeEnvironment === "HOMOLOGATION";
  const sefaz = await authorizeNfe({
    uf: config!.uf ?? "SP",
    homologation: homolog,
    enviNFeXml: enviNFe,
    pfx: cert.pfx,
    password: cert.password,
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.fiscalInvoiceEvent.create({
      data: {
        fiscalInvoiceId: invoice.id,
        eventType: "NFeAutorizacao",
        requestPayload: enviNFe.slice(0, 50000),
        responsePayload: (sefaz.rawResponse || sefaz.error || "").slice(0, 50000),
        success: sefaz.ok,
      },
    });

    if (sefaz.ok) {
      return tx.fiscalInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "AUTHORIZED",
          accessKey: sefaz.parsed.chNFe ?? accessKey,
          xmlSigned: signedNFe,
          xmlAuthorized: sefaz.rawResponse || signedNFe,
          protocol: sefaz.parsed.nProt ?? null,
          issuedAt,
          rejectionReason: null,
        },
        include: { items: true, order: true },
      });
    }

    return tx.fiscalInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "REJECTED",
        accessKey,
        xmlSigned: signedNFe,
        issuedAt,
        rejectionReason: sefaz.error ?? sefaz.parsed.xMotivo ?? "Rejeitada pela SEFAZ",
      },
      include: { items: true, order: true },
    });
  });

  if (!sefaz.ok) {
    return { ok: false as const, error: sefaz.error ?? "Rejeitada pela SEFAZ", invoice: updated };
  }

  return { ok: true as const, invoice: updated };
}

export async function cancelOutboundInvoice(
  organizationId: string,
  invoiceId: string,
  justification: string,
) {
  const invoice = await prisma.fiscalInvoice.findFirst({
    where: { id: invoiceId, organizationId, direction: "OUTBOUND" },
  });
  if (!invoice) return { ok: false as const, error: "Nota não encontrada" };
  if (invoice.status !== "AUTHORIZED") {
    return { ok: false as const, error: "Somente NF-e autorizada pode ser cancelada" };
  }
  if (!invoice.accessKey || !invoice.protocol) {
    return { ok: false as const, error: "Chave ou protocolo ausentes" };
  }
  if (justification.trim().length < 15) {
    return { ok: false as const, error: "Justificativa deve ter no mínimo 15 caracteres" };
  }

  const config = await prisma.organizationFiscalConfig.findUnique({ where: { organizationId } });
  const issues = validateOrganizationFiscalConfig(config);
  if (issues.length) return { ok: false as const, error: issues.map((i) => i.message).join("; ") };

  const cert = await loadOrganizationCertificate(organizationId);
  if (!cert) return { ok: false as const, error: "Certificado A1 não disponível" };

  const homolog = config!.nfeEnvironment === "HOMOLOGATION";
  const { infEvento } = buildCancelamentoEvento({
    accessKey: invoice.accessKey,
    cnpj: config!.cnpj ?? "",
    uf: config!.uf ?? "SP",
    homologation: homolog,
    protocol: invoice.protocol,
    justification,
  });
  const signedEvento = signInfEvento(infEvento, cert.privateKeyPem, cert.certPem);
  const envEvento = wrapEnvEvento(signedEvento);

  const sefaz = await sendNfeEvento({
    uf: config!.uf ?? "SP",
    homologation: homolog,
    envEventoXml: envEvento,
    pfx: cert.pfx,
    password: cert.password,
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.fiscalInvoiceEvent.create({
      data: {
        fiscalInvoiceId: invoice.id,
        eventType: "NFeCancelamento",
        requestPayload: envEvento.slice(0, 50000),
        responsePayload: (sefaz.rawResponse || sefaz.error || "").slice(0, 50000),
        success: sefaz.ok,
      },
    });

    if (!sefaz.ok) {
      return tx.fiscalInvoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { items: true, order: true },
      });
    }

    return tx.fiscalInvoice.update({
      where: { id: invoice.id },
      data: { status: "CANCELLED", rejectionReason: justification.trim() },
      include: { items: true, order: true },
    });
  });

  if (!sefaz.ok) {
    return { ok: false as const, error: sefaz.error ?? "Cancelamento rejeitado pela SEFAZ", invoice: updated };
  }

  return { ok: true as const, invoice: updated };
}

function buildIssuerSnapshot(cfg: OrganizationFiscalConfig) {
  return {
    cnpj: cfg.cnpj,
    ie: cfg.stateRegistration,
    uf: cfg.uf,
    city: cfg.city,
    street: cfg.street,
    number: cfg.addressNumber,
  };
}

function buildRecipientSnapshot(customer: Parameters<typeof customerFiscalRecipientSnapshot>[0]) {
  return customerFiscalRecipientSnapshot(customer);
}

export async function listEligibleOutboundOrders(organizationId: string) {
  const config = await prisma.organizationFiscalConfig.findUnique({
    where: { organizationId },
  });

  const orders = await prisma.order.findMany({
    where: { organizationId, status: "CONFIRMED" },
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      seller: { include: { user: { select: { name: true } } } },
      items: { include: { product: true } },
      fiscalInvoices: {
        where: { direction: "OUTBOUND" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, accessKey: true, number: true, series: true },
      },
    },
  });

  return orders.map((o) => {
    const orgIssues = validateOrganizationFiscalConfigForEmit(config);
    const customerIssues = o.customer ? validateCustomerFiscal(o.customer) : [{ code: "NO_CUSTOMER", message: "Pedido sem cliente" }];
    const productIssues = o.items.flatMap((i) => validateProductFiscal(i.product));
    const readinessIssues = [...orgIssues, ...customerIssues, ...productIssues];

    return {
      ...o,
      customer: o.customer
        ? {
            id: o.customer.id,
            name: o.customer.name,
            document: customerFiscalDocument(o.customer),
          }
        : null,
      fiscalStatus: (o.fiscalInvoices[0]?.status ?? "NONE") as
        | import("@prisma/client").FiscalInvoiceStatus
        | "NONE",
      fiscalInvoice: o.fiscalInvoices[0] ?? null,
      readinessIssues,
      canEmit: readinessIssues.length === 0 && !o.fiscalInvoices[0],
    };
  });
}
