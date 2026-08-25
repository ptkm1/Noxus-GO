import { prisma } from "../db.js";
import { parseInboundNfeXml } from "../fiscal/nfe-xml.js";
import { applyInboundInvoiceStock, reverseInboundInvoiceStock } from "./stock.js";
import { loadOrganizationCertificate } from "../fiscal/certificate-store.js";
import { consultDistDfe } from "../fiscal/sefaz-dfe.js";
import { UF_IBGE } from "../fiscal/sefaz-endpoints.js";
import { buildManifestacaoEvento, wrapEnvEvento } from "../fiscal/nfe-event-xml.js";
import { signInfEvento } from "../fiscal/nfe-signer.js";
import { sendNfeEvento } from "../fiscal/sefaz-client.js";
import type { FiscalManifestationType } from "@prisma/client";

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
      organizationId_cnpj: {
        organizationId,
        cnpj: parsed.issuer.cnpj,
      },
    },
    create: {
      organizationId,
      code: parsed.issuer.cnpj.slice(0, 8),
      legalName: parsed.issuer.name,
      tradeName: parsed.issuer.name,
      cnpj: parsed.issuer.cnpj,
      stateRegistration: parsed.issuer.ie,
      street: parsed.issuer.street,
      city: parsed.issuer.city,
      state: parsed.issuer.state,
      zipCode: parsed.issuer.zipCode,
    },
    update: {
      legalName: parsed.issuer.name,
      tradeName: parsed.issuer.name,
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
  const config = await prisma.establishment.findFirst({ where: { organizationId, isPrimary: true } });
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

/** Lista notas de entrada ainda não finalizadas. */
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

export async function syncInboundDfe(organizationId: string, ultNsu?: string) {
  const config = await prisma.establishment.findFirst({
    where: { organizationId, isPrimary: true },
  });
  if (!config?.certificatePfxEncrypted) {
    return { ok: false as const, error: "Certificado A1 obrigatório para consulta DF-e" };
  }
  if (!config.cnpj || !config.uf) {
    return { ok: false as const, error: "CNPJ e UF do emitente obrigatórios" };
  }

  const cert = await loadOrganizationCertificate(organizationId);
  if (!cert) return { ok: false as const, error: "Certificado A1 não disponível" };

  const result = await consultDistDfe({
    cnpj: config.cnpj,
    ufIbge: UF_IBGE[config.uf.toUpperCase()] ?? "35",
    homologation: config.nfeEnvironment === "HOMOLOGATION",
    ultNsu,
    pfx: cert.pfx,
    password: cert.password,
  });

  if (!result.ok && result.cStat !== "137") {
    return {
      ok: false as const,
      error: result.error ?? "Falha na consulta DF-e",
      cStat: result.cStat,
      ultNSU: result.ultNSU,
    };
  }

  let imported = 0;
  const pending: { accessKey: string; schema: string; nsu: string }[] = [];

  for (const doc of result.documents) {
    if (!doc.xml || doc.xml.startsWith("gzip:")) continue;
    if (/<NFe[\s>]|<nfeProc[\s>]/i.test(doc.xml) && doc.accessKey) {
      const existing = await prisma.fiscalInvoice.findUnique({
        where: { accessKey: doc.accessKey },
      });
      if (!existing) {
        const imp = await importInboundNfeXml(organizationId, doc.xml);
        if (imp.ok) imported += 1;
      }
    } else if (doc.accessKey) {
      pending.push({ accessKey: doc.accessKey, schema: doc.schema, nsu: doc.nsu });
    }
  }

  return {
    ok: true as const,
    message:
      result.cStat === "137"
        ? "Nenhum documento novo na SEFAZ (NSU em dia)."
        : `Consulta DF-e ok. ${imported} XML(s) importados; ${pending.length} pendente(s) de manifestação.`,
    imported,
    pending,
    ultNSU: result.ultNSU,
    maxNSU: result.maxNSU,
    cStat: result.cStat,
  };
}

export async function manifestInboundNfe(
  organizationId: string,
  accessKey: string,
  type: FiscalManifestationType,
  justification?: string,
) {
  const config = await prisma.establishment.findFirst({
    where: { organizationId, isPrimary: true },
  });
  if (!config?.certificatePfxEncrypted || !config.cnpj) {
    return { ok: false as const, error: "Certificado A1 e CNPJ obrigatórios" };
  }
  const cert = await loadOrganizationCertificate(organizationId);
  if (!cert) return { ok: false as const, error: "Certificado A1 não disponível" };

  let infEvento: string;
  try {
    ({ infEvento } = buildManifestacaoEvento({
      accessKey,
      cnpj: config.cnpj,
      homologation: config.nfeEnvironment === "HOMOLOGATION",
      type,
      justification,
    }));
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Evento inválido" };
  }

  const signed = signInfEvento(infEvento, cert.privateKeyPem, cert.certPem);
  const envEvento = wrapEnvEvento(signed);
  const sefaz = await sendNfeEvento({
    uf: config.uf ?? "SP",
    homologation: config.nfeEnvironment === "HOMOLOGATION",
    envEventoXml: envEvento,
    pfx: cert.pfx,
    password: cert.password,
  });

  const invoice = await prisma.fiscalInvoice.findFirst({
    where: { organizationId, accessKey, direction: "INBOUND" },
  });

  if (invoice) {
    await prisma.fiscalInvoiceEvent.create({
      data: {
        fiscalInvoiceId: invoice.id,
        eventType: `Manifestacao-${type}`,
        requestPayload: envEvento.slice(0, 50000),
        responsePayload: (sefaz.rawResponse || sefaz.error || "").slice(0, 50000),
        success: sefaz.ok,
      },
    });
    if (sefaz.ok) {
      await prisma.fiscalInvoice.update({
        where: { id: invoice.id },
        data: { manifestationType: type },
      });
    }
  }

  if (!sefaz.ok) {
    return { ok: false as const, error: sefaz.error ?? "Manifestação rejeitada" };
  }
  return { ok: true as const, type, accessKey };
}
