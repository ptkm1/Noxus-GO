import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/org-roles.js";
import { prisma } from "../db.js";
import { sendZodError } from "../util/zod-reply.js";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  auditFromAuth,
} from "../services/audit-log.js";
import {
  createEstablishment,
  EstablishmentError,
  listEstablishmentsForUser,
  updateEstablishment,
  userCanAccessEstablishment,
} from "../services/establishments.js";

const idParam = z.object({ id: z.string().min(1) });

const createBody = z.object({
  legalName: z.string().min(1),
  tradeName: z.string().optional().nullable(),
  cnpj: z.string().min(14),
  stateRegistration: z.string().optional().nullable(),
  municipalRegistration: z.string().optional().nullable(),
  taxRegime: z
    .enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL"])
    .optional(),
  uf: z.string().max(2).optional().nullable(),
  cityIbge: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  addressNumber: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  nfeEnvironment: z.enum(["HOMOLOGATION", "PRODUCTION"]).optional(),
  nfeSeries: z.number().int().positive().optional(),
  isPrimary: z.boolean().optional(),
});

export const establishmentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (req) => {
    const auth = req.auth!;
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: {
        allowedEstablishmentIds: true,
        preferredEstablishmentId: true,
      },
    });
    const items = await listEstablishmentsForUser({
      organizationId: auth.organizationId,
      role: auth.role,
      allowedEstablishmentIds: user?.allowedEstablishmentIds,
      activeOnly: false,
    });
    return {
      items,
      preferredEstablishmentId: user?.preferredEstablishmentId ?? null,
    };
  });

  app.put("/preferred", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({ establishmentId: z.string().min(1) })
      .safeParse(req.body);
    if (!body.success) return sendZodError(reply, body.error, req);

    const est = await prisma.establishment.findFirst({
      where: {
        id: body.data.establishmentId,
        organizationId: auth.organizationId,
        active: true,
      },
      select: { id: true },
    });
    if (!est) {
      return reply.status(400).send({ error: "Estabelecimento inválido" });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { allowedEstablishmentIds: true, role: true },
    });
    if (
      !userCanAccessEstablishment({
        role: auth.role,
        allowedEstablishmentIds: user?.allowedEstablishmentIds,
        establishmentId: est.id,
      })
    ) {
      return reply.status(403).send({ error: "Sem permissão para este CNPJ" });
    }

    await prisma.user.update({
      where: { id: auth.sub },
      data: { preferredEstablishmentId: est.id },
    });
    return { ok: true, preferredEstablishmentId: est.id };
  });

  app.post("/", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const body = createBody.safeParse(req.body);
    if (!body.success) return sendZodError(reply, body.error, req);
    try {
      const created = await createEstablishment(auth.organizationId, body.data);
      await auditFromAuth(auth, {
        action: AUDIT_ACTION.CREATE,
        entityType: AUDIT_ENTITY.FiscalConfig,
        entityId: created.id,
        metadata: { cnpj: created.cnpj, op: "establishment" },
      });
      return reply.status(201).send(created);
    } catch (e) {
      if (e instanceof EstablishmentError) {
        return reply
          .status(e.httpStatus)
          .send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });

  app.patch("/:id", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const id = idParam.safeParse(req.params);
    if (!id.success) return sendZodError(reply, id.error, req);
    const body = createBody
      .partial()
      .extend({
        active: z.boolean().optional(),
        contingencyEnabled: z.boolean().optional(),
        autoStockOnInboundInvoice: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return sendZodError(reply, body.error, req);
    try {
      const updated = await updateEstablishment(
        auth.organizationId,
        id.data.id,
        body.data,
      );
      await auditFromAuth(auth, {
        action: AUDIT_ACTION.UPDATE,
        entityType: AUDIT_ENTITY.FiscalConfig,
        entityId: updated.id,
        metadata: { fields: Object.keys(body.data), op: "establishment" },
      });
      return updated;
    } catch (e) {
      if (e instanceof EstablishmentError) {
        return reply
          .status(e.httpStatus)
          .send({ error: e.message, code: e.code });
      }
      throw e;
    }
  });
};
