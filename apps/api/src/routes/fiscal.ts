import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/org-roles.js";
import { prisma } from "../db.js";
import { certificateStatus, parsePfxMetadata } from "../fiscal/certificate.js";
import { parseLogoUpload } from "../fiscal/danfe-logo.js";
import { encryptBuffer, encryptSecret } from "../fiscal/encryption.js";
import { confirmInboundImport, cancelInboundInvoice, importInboundNfeXml, listInboundPending, manifestInboundNfe, syncInboundDfe } from "../services/fiscal-inbound.js";
import {
  buildOutboundInvoiceFromOrder,
  cancelOutboundInvoice,
  listEligibleOutboundOrders,
  transmitOutboundInvoice,
} from "../services/fiscal-outbound.js";
import { loadInvoiceForDanfe, sendDanfePdfReply } from "../services/nfe-danfe-load.js";

const idParam = z.object({ id: z.string().min(1) });

export const fiscalRoutes: FastifyPluginAsync = async (app) => {
  app.get("/settings", async (req) => {
    const auth = req.auth!;
    const config = await prisma.organizationFiscalConfig.findUnique({
      where: { organizationId: auth.organizationId },
    });
    if (!config) {
      return {
        configured: false,
        autoStockOnInboundInvoice: false,
      };
    }
    const cert = certificateStatus(config.certificateExpiresAt);
    return {
      configured: true,
      cnpj: config.cnpj,
      stateRegistration: config.stateRegistration,
      municipalRegistration: config.municipalRegistration,
      taxRegime: config.taxRegime,
      uf: config.uf,
      cityIbge: config.cityIbge,
      street: config.street,
      addressNumber: config.addressNumber,
      complement: config.complement,
      district: config.district,
      city: config.city,
      zipCode: config.zipCode,
      nfeEnvironment: config.nfeEnvironment,
      nfeSeries: config.nfeSeries,
      nfeLastNumber: config.nfeLastNumber,
      autoStockOnInboundInvoice: config.autoStockOnInboundInvoice,
      logo: {
        uploaded: Boolean(config.danfeLogoBytes?.length),
        mimeType: config.danfeLogoMimeType,
      },
      certificate: {
        uploaded: Boolean(config.certificatePfxEncrypted),
        cnpj: config.certificateCnpj,
        expiresAt: config.certificateExpiresAt,
        ...cert,
      },
    };
  });

  app.put("/settings", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const body = z
      .object({
        cnpj: z.string().optional(),
        stateRegistration: z.string().optional(),
        municipalRegistration: z.string().optional(),
        taxRegime: z.enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL"]).optional(),
        uf: z.string().max(2).optional(),
        cityIbge: z.string().optional(),
        street: z.string().optional(),
        addressNumber: z.string().optional(),
        complement: z.string().optional(),
        district: z.string().optional(),
        city: z.string().optional(),
        zipCode: z.string().optional(),
        nfeEnvironment: z.enum(["HOMOLOGATION", "PRODUCTION"]).optional(),
        nfeSeries: z.number().int().positive().optional(),
        autoStockOnInboundInvoice: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });

    return prisma.organizationFiscalConfig.upsert({
      where: { organizationId: auth.organizationId },
      create: { organizationId: auth.organizationId, ...body.data },
      update: body.data,
    });
  });

  app.post("/certificate", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const body = z
      .object({
        pfxBase64: z.string().min(1),
        password: z.string().min(1),
      })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });

    let pfx: Buffer;
    try {
      pfx = Buffer.from(body.data.pfxBase64, "base64");
    } catch {
      return reply.status(400).send({ error: "Arquivo PFX inválido" });
    }

    const meta = parsePfxMetadata(pfx, body.data.password);

    let encryptedPfx: Buffer;
    let encryptedPassword: string;
    try {
      encryptedPfx = encryptBuffer(pfx);
      encryptedPassword = encryptSecret(body.data.password);
    } catch (e) {
      return reply.status(500).send({
        error: e instanceof Error ? e.message : "Falha ao criptografar certificado",
      });
    }

    await prisma.organizationFiscalConfig.upsert({
      where: { organizationId: auth.organizationId },
      create: {
        organizationId: auth.organizationId,
        certificatePfxEncrypted: new Uint8Array(encryptedPfx),
        certificatePasswordEncrypted: encryptedPassword,
        certificateExpiresAt: meta.expiresAt,
        certificateCnpj: meta.cnpj,
      },
      update: {
        certificatePfxEncrypted: new Uint8Array(encryptedPfx),
        certificatePasswordEncrypted: encryptedPassword,
        certificateExpiresAt: meta.expiresAt,
        certificateCnpj: meta.cnpj,
      },
    });

    return { ok: true, certificate: meta };
  });

  app.get("/logo", async (req, reply) => {
    const auth = req.auth!;
    const config = await prisma.organizationFiscalConfig.findUnique({
      where: { organizationId: auth.organizationId },
      select: { danfeLogoBytes: true, danfeLogoMimeType: true },
    });
    if (!config?.danfeLogoBytes?.length) {
      return reply.status(404).send({ error: "Logo não configurada" });
    }
    return reply
      .header("Content-Type", config.danfeLogoMimeType ?? "image/png")
      .header("Cache-Control", "private, max-age=300")
      .send(Buffer.from(config.danfeLogoBytes));
  });

  app.post("/logo", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const body = z
      .object({
        imageBase64: z.string().min(1),
        mimeType: z.string().min(1),
      })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });

    const parsed = parseLogoUpload(body.data.imageBase64, body.data.mimeType);
    if (!parsed) {
      return reply.status(400).send({
        error: "Imagem inválida. Use PNG, JPEG, WebP ou GIF com até 512 KB.",
      });
    }

    await prisma.organizationFiscalConfig.upsert({
      where: { organizationId: auth.organizationId },
      create: {
        organizationId: auth.organizationId,
        danfeLogoBytes: new Uint8Array(parsed.buffer),
        danfeLogoMimeType: parsed.mimeType,
      },
      update: {
        danfeLogoBytes: new Uint8Array(parsed.buffer),
        danfeLogoMimeType: parsed.mimeType,
      },
    });

    return { ok: true, mimeType: parsed.mimeType };
  });

  app.delete("/logo", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    await prisma.organizationFiscalConfig.updateMany({
      where: { organizationId: auth.organizationId },
      data: { danfeLogoBytes: null, danfeLogoMimeType: null },
    });
    return { ok: true };
  });

  app.get("/ncm", async (req) => {
    const auth = req.auth!;
    return prisma.fiscalNcm.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { code: "asc" },
    });
  });

  app.post("/ncm", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const body = z
      .object({
        code: z.string().min(8).max(8),
        description: z.string().min(1),
        cest: z.string().optional(),
        defaultCstIcms: z.string().optional(),
        defaultCsosn: z.string().optional(),
        icmsRate: z.number().optional(),
        pisRate: z.number().optional(),
        cofinsRate: z.number().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });
    return prisma.fiscalNcm.create({
      data: { organizationId: auth.organizationId, ...body.data },
    });
  });

  app.patch("/ncm/:id", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        description: z.string().optional(),
        cest: z.string().nullable().optional(),
        defaultCstIcms: z.string().nullable().optional(),
        defaultCsosn: z.string().nullable().optional(),
        icmsRate: z.number().nullable().optional(),
        pisRate: z.number().nullable().optional(),
        cofinsRate: z.number().nullable().optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });
    const row = await prisma.fiscalNcm.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!row) return reply.status(404).send({ error: "Não encontrado" });
    return prisma.fiscalNcm.update({ where: { id }, data: body.data });
  });

  app.get("/operations", async (req) => {
    const auth = req.auth!;
    const q = z.object({ direction: z.enum(["INBOUND", "OUTBOUND"]).optional() }).safeParse(req.query);
    return prisma.fiscalOperation.findMany({
      where: {
        organizationId: auth.organizationId,
        direction: q.success ? q.data.direction : undefined,
      },
      orderBy: { cfop: "asc" },
    });
  });

  app.post("/operations", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const body = z
      .object({
        direction: z.enum(["INBOUND", "OUTBOUND"]),
        cfop: z.string().length(4),
        description: z.string().min(1),
        nature: z.string().optional(),
        defaultCstIcms: z.string().optional(),
        defaultCsosn: z.string().optional(),
        movesStock: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });
    return prisma.fiscalOperation.create({
      data: { organizationId: auth.organizationId, ...body.data },
    });
  });

  app.patch("/operations/:id", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        description: z.string().optional(),
        nature: z.string().nullable().optional(),
        defaultCstIcms: z.string().nullable().optional(),
        defaultCsosn: z.string().nullable().optional(),
        movesStock: z.boolean().optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });
    const row = await prisma.fiscalOperation.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!row) return reply.status(404).send({ error: "Não encontrado" });
    return prisma.fiscalOperation.update({ where: { id }, data: body.data });
  });

  app.get("/outbound/orders", async (req) => {
    const auth = req.auth!;
    return listEligibleOutboundOrders(auth.organizationId);
  });

  app.post("/outbound/from-order/:orderId", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const { orderId } = z.object({ orderId: z.string() }).parse(req.params);
    const result = await buildOutboundInvoiceFromOrder(auth.organizationId, orderId);
    if (!result.ok) {
      const summary = result.issues.map((i) => i.message).join("; ");
      return reply.status(400).send({ error: summary, issues: result.issues });
    }
    return result.invoice;
  });

  app.post("/outbound/invoices/:id/transmit", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const { id } = idParam.parse(req.params);
    const result = await transmitOutboundInvoice(auth.organizationId, id);
    if (!result.ok) return reply.status(400).send({ error: result.error });
    return result.invoice;
  });

  app.get("/outbound/invoices", async (req) => {
    const auth = req.auth!;
    return prisma.fiscalInvoice.findMany({
      where: { organizationId: auth.organizationId, direction: "OUTBOUND" },
      orderBy: { createdAt: "desc" },
      include: { order: { include: { customer: true } }, items: true },
    });
  });

  app.get("/outbound/invoices/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const row = await prisma.fiscalInvoice.findFirst({
      where: { id, organizationId: auth.organizationId, direction: "OUTBOUND" },
      include: { items: { include: { product: true } }, order: { include: { customer: true } }, events: true },
    });
    if (!row) return reply.status(404).send({ error: "Não encontrado" });
    return row;
  });

  app.get("/invoices/:id/danfe.pdf", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const invoice = await loadInvoiceForDanfe(auth.organizationId, id);
    if (!invoice) return reply.status(404).send({ error: "Não encontrado" });
    return sendDanfePdfReply(reply, invoice);
  });

  app.post("/outbound/invoices/:id/cancel", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const { id } = idParam.parse(req.params);
    const body = z.object({ justification: z.string().min(15) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Justificativa obrigatória (mín. 15 caracteres)" });
    const result = await cancelOutboundInvoice(auth.organizationId, id, body.data.justification);
    if (!result.ok) return reply.status(400).send({ error: result.error });
    return result.invoice;
  });

  app.get("/inbound/pending", async (req) => {
    const auth = req.auth!;
    return listInboundPending(auth.organizationId);
  });

  app.get("/inbound/invoices", async (req) => {
    const auth = req.auth!;
    return prisma.fiscalInvoice.findMany({
      where: { organizationId: auth.organizationId, direction: "INBOUND" },
      orderBy: { createdAt: "desc" },
      include: { supplier: true, items: { include: { product: true } } },
    });
  });

  app.post("/inbound/import-xml", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const body = z.object({ xml: z.string().min(10) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "XML obrigatório" });
    const result = await importInboundNfeXml(auth.organizationId, body.data.xml);
    if (!result.ok) return reply.status(400).send({ error: result.error });
    return result.invoice;
  });

  app.post("/inbound/invoices/:id/confirm-import", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({ productMappings: z.record(z.string(), z.string()).default({}) })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });
    const result = await confirmInboundImport(
      auth.organizationId,
      id,
      body.data.productMappings,
      auth.sub,
    );
    if (!result.ok) return reply.status(400).send({ error: result.error });
    return result;
  });

  app.post("/inbound/invoices/:id/cancel", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const { id } = idParam.parse(req.params);
    const body = z.object({ justification: z.string().min(15) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Justificativa obrigatória (mín. 15 caracteres)" });
    const result = await cancelInboundInvoice(
      auth.organizationId,
      id,
      body.data.justification,
      auth.sub,
    );
    if (!result.ok) return reply.status(400).send({ error: result.error });
    return result.invoice;
  });

  app.post("/inbound/sync", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const body = z.object({ ultNsu: z.string().optional() }).safeParse(req.body ?? {});
    const result = await syncInboundDfe(
      auth.organizationId,
      body.success ? body.data.ultNsu : undefined,
    );
    if (!result.ok) return reply.status(400).send({ error: result.error, cStat: "cStat" in result ? result.cStat : undefined, ultNSU: "ultNSU" in result ? result.ultNSU : undefined });
    return result;
  });

  app.post("/inbound/:accessKey/manifest", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const { accessKey } = z.object({ accessKey: z.string().length(44) }).parse(req.params);
    const body = z
      .object({
        type: z.enum(["CIENCIA", "CONFIRMACAO", "DESCONHECIMENTO", "NAO_REALIZADA"]),
        justification: z.string().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Tipo de manifestação inválido" });
    const result = await manifestInboundNfe(
      auth.organizationId,
      accessKey,
      body.data.type,
      body.data.justification,
    );
    if (!result.ok) return reply.status(400).send({ error: result.error });
    return result;
  });
};
