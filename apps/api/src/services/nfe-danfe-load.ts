import type { FastifyReply } from "fastify";
import { prisma } from "../db.js";
import { customerFiscalDocument } from "../fiscal/customer-fiscal.js";
import { normalizeNfeNature } from "../fiscal/nfe-xml-builder.js";
import {
  parseNfeXmlForDanfe,
  type DanfeNfeData,
} from "../fiscal/nfe-xml-danfe.js";
import { buildDanfePdf, danfePdfFilename } from "./nfe-danfe-pdf.js";

const DANFE_STATUSES = new Set(["AUTHORIZED", "IMPORTED", "CANCELLED"]);

export async function loadFiscalDanfeLogo(
  organizationId: string,
  establishmentId?: string | null,
) {
  const config = establishmentId
    ? await prisma.establishment.findFirst({
        where: { id: establishmentId, organizationId },
        select: { danfeLogoBytes: true, danfeLogoMimeType: true },
      })
    : await prisma.establishment.findFirst({
        where: { organizationId, isPrimary: true },
        select: { danfeLogoBytes: true, danfeLogoMimeType: true },
      });
  if (!config?.danfeLogoBytes?.length) return null;
  return {
    buffer: Buffer.from(config.danfeLogoBytes),
    mimeType: config.danfeLogoMimeType ?? "image/png",
  };
}

export async function loadInvoiceForDanfe(
  organizationId: string,
  invoiceId: string,
) {
  return prisma.fiscalInvoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: {
      items: true,
      order: { include: { customer: true } },
      supplier: true,
    },
  });
}

function buildFallbackFromInvoice(
  invoice: NonNullable<Awaited<ReturnType<typeof loadInvoiceForDanfe>>>,
): Partial<DanfeNfeData> {
  const issuerSnap = invoice.issuerSnapshot as Record<string, string> | null;
  const recipientSnap = invoice.recipientSnapshot as Record<
    string,
    string
  > | null;

  const emitter =
    invoice.direction === "OUTBOUND"
      ? {
          document: issuerSnap?.cnpj ?? "",
          name: issuerSnap?.name ?? "Emitente",
          ie: issuerSnap?.ie,
          street: issuerSnap?.street,
          number: issuerSnap?.number,
          city: issuerSnap?.city,
          state: issuerSnap?.uf,
        }
      : {
          document: invoice.supplier?.cnpj ?? issuerSnap?.cnpj ?? "",
          name: invoice.supplier?.legalName ?? issuerSnap?.name ?? "Fornecedor",
          ie: invoice.supplier?.stateRegistration ?? issuerSnap?.ie,
          street: invoice.supplier?.street ?? issuerSnap?.street,
          city: invoice.supplier?.city ?? issuerSnap?.city,
          state: invoice.supplier?.state ?? issuerSnap?.state,
          zipCode: invoice.supplier?.zipCode ?? issuerSnap?.zipCode,
        };

  const recipient =
    invoice.direction === "OUTBOUND"
      ? {
          document:
            recipientSnap?.document ??
            customerFiscalDocument(invoice.order?.customer ?? {}) ??
            "",
          name: recipientSnap?.name ?? invoice.order?.customer?.name ?? "",
          ie: recipientSnap?.stateRegistration,
          street: recipientSnap?.street,
          number: recipientSnap?.addressNumber,
          district: recipientSnap?.district,
          city: recipientSnap?.city,
          state: recipientSnap?.state,
          zipCode: recipientSnap?.zipCode,
        }
      : {
          document: issuerSnap?.cnpj ?? "",
          name: issuerSnap?.name ?? "Destinatário",
        };

  return {
    accessKey: invoice.accessKey ?? undefined,
    number: invoice.number ?? undefined,
    series: invoice.series ?? undefined,
    issuedAt: invoice.issuedAt,
    protocol: invoice.protocol ?? undefined,
    cancelled: invoice.status === "CANCELLED",
    nature: issuerSnap?.nature
      ? normalizeNfeNature(issuerSnap.nature)
      : undefined,
    emitter,
    recipient,
    totalNfe: Number(invoice.totalAmount),
    totalProducts: Number(invoice.totalAmount),
    items: invoice.items.map((it) => ({
      lineNumber: it.lineNumber,
      description: it.description,
      ncm: it.ncm ?? undefined,
      cfop: it.cfop ?? undefined,
      unit: it.unit ?? undefined,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      totalPrice: Number(it.totalPrice),
    })),
  };
}

export async function buildDanfePdfForInvoice(
  invoice: NonNullable<Awaited<ReturnType<typeof loadInvoiceForDanfe>>>,
): Promise<
  { ok: true; pdf: Buffer; filename: string } | { ok: false; error: string }
> {
  if (!DANFE_STATUSES.has(invoice.status)) {
    return {
      ok: false,
      error: "DANFE disponível apenas para notas autorizadas ou importadas",
    };
  }

  // xmlAuthorized costuma ser só o protocolo SEFAZ (sem ide/natOp/itens).
  // Preferir o XML assinado completo; protocolo/protocolDate vêm do fallback.
  const xml = invoice.xmlSigned ?? invoice.xmlAuthorized;
  if (!xml && invoice.items.length === 0) {
    return { ok: false, error: "XML da nota não disponível" };
  }

  const fallback = await enrichFallbackNature(
    invoice.organizationId,
    buildFallbackFromInvoice(invoice),
    invoice,
  );
  const parsed = xml ? parseNfeXmlForDanfe(xml, fallback) : null;
  const data =
    parsed ?? (fallback.accessKey ? (fallback as DanfeNfeData) : null);
  if (!data?.accessKey) {
    return {
      ok: false,
      error: "Não foi possível montar DANFE para esta nota",
    };
  }
  if (!data.nature?.trim() && fallback.nature) {
    data.nature = fallback.nature;
  } else if (
    fallback.nature &&
    /^VENDA$/i.test((data.nature ?? "").trim()) &&
    !/^VENDA$/i.test(fallback.nature.trim())
  ) {
    // Notas antigas gravavam natOp fixo "VENDA"; preferir o cadastro do CFOP no DANFE.
    data.nature = fallback.nature;
  }

  const logo = await loadFiscalDanfeLogo(invoice.organizationId);
  if (logo) {
    data.logo = logo;
  }

  const pdf = await buildDanfePdf(data as DanfeNfeData);
  const filename = danfePdfFilename(invoice.id, invoice.number);
  return { ok: true, pdf, filename };
}

async function enrichFallbackNature(
  organizationId: string,
  fallback: Partial<DanfeNfeData>,
  invoice: NonNullable<Awaited<ReturnType<typeof loadInvoiceForDanfe>>>,
): Promise<Partial<DanfeNfeData>> {
  if (fallback.nature?.trim()) return fallback;

  for (const it of invoice.items) {
    const snap = it.taxSnapshot as { natOp?: string } | null;
    if (snap?.natOp?.trim()) {
      return { ...fallback, nature: normalizeNfeNature(snap.natOp) };
    }
  }

  const cfop = invoice.items.find((i) => i.cfop?.trim())?.cfop?.trim();
  if (!cfop) {
    return { ...fallback, nature: normalizeNfeNature(null) };
  }

  const op = await prisma.fiscalOperation.findFirst({
    where: {
      organizationId,
      direction: "OUTBOUND",
      cfop,
      active: true,
    },
    select: { nature: true, description: true },
  });
  return {
    ...fallback,
    nature: normalizeNfeNature(op?.nature || op?.description),
  };
}

export async function sendDanfePdfReply(
  reply: FastifyReply,
  invoice: NonNullable<Awaited<ReturnType<typeof loadInvoiceForDanfe>>>,
) {
  const built = await buildDanfePdfForInvoice(invoice);
  if (!built.ok) {
    return reply.status(400).send({ error: built.error });
  }
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `inline; filename="${built.filename}"`)
    .send(built.pdf);
}
