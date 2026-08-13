import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  buildExpeditionLabelPdf,
  parseLabelSize,
} from "../services/expedition-label-pdf.js";
import {
  ExpeditionError,
  adjustExpeditionItem,
  completeExpedition,
  getExpeditionOrder,
  listExpeditionQueue,
  markExpeditionShipped,
  recordLabelPrint,
  scanExpeditionItem,
  setExpeditionVolumes,
  startExpedition,
} from "../services/expedition.js";
import { canWriteEffective } from "../services/role-permissions.js";

function sendExpeditionError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  e: unknown,
) {
  if (e instanceof ExpeditionError) {
    return reply.status(e.httpStatus).send({ error: e.message, code: e.code });
  }
  throw e;
}

export const expeditionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/expedition/orders", async (req, reply) => {
    const auth = req.auth!;
    const q = z
      .object({
        status: z
          .enum(["DRAFT", "CONFIRMED", "CANCELLED", "PENDING_CREDIT_APPROVAL"])
          .optional(),
        situationCode: z.string().optional(),
        orderNumber: z.string().optional(),
        city: z.string().optional(),
        tradeName: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .safeParse(req.query);
    const f = q.success ? q.data : {};
    let orderNumber: number | undefined;
    if (f.orderNumber?.trim()) {
      if (!/^\d+$/.test(f.orderNumber.trim())) {
        return reply
          .status(400)
          .send({ error: "Número do pedido deve conter apenas dígitos" });
      }
      orderNumber = Number(f.orderNumber.trim());
    }
    return listExpeditionQueue({
      auth,
      status: f.status,
      situationCode: f.situationCode,
      orderNumber,
      city: f.city,
      tradeName: f.tradeName,
      from: f.from,
      to: f.to,
    });
  });

  app.get("/expedition/orders/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      return await getExpeditionOrder(auth, id);
    } catch (e) {
      return sendExpeditionError(reply, e);
    }
  });

  app.post("/expedition/orders/:id/start", async (req, reply) => {
    const auth = req.auth!;
    if (
      !(await canWriteEffective(auth.organizationId, auth.role, "expedition"))
    ) {
      return reply.status(403).send({ error: "Sem permissão para expedição" });
    }
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      return await startExpedition(auth, id);
    } catch (e) {
      return sendExpeditionError(reply, e);
    }
  });

  app.post("/expedition/orders/:id/scan", async (req, reply) => {
    const auth = req.auth!;
    if (
      !(await canWriteEffective(auth.organizationId, auth.role, "expedition"))
    ) {
      return reply.status(403).send({ error: "Sem permissão para expedição" });
    }
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({ barcode: z.string().min(1).max(80) })
      .safeParse(req.body);
    if (!body.success) {
      return reply.status(400).send({
        error: "Informe o código de barras.",
        code: "EMPTY_CODE",
      });
    }
    try {
      return await scanExpeditionItem({
        auth,
        orderId: id,
        barcode: body.data.barcode,
      });
    } catch (e) {
      return sendExpeditionError(reply, e);
    }
  });

  app.post("/expedition/orders/:id/adjust", async (req, reply) => {
    const auth = req.auth!;
    if (
      !(await canWriteEffective(auth.organizationId, auth.role, "expedition"))
    ) {
      return reply.status(403).send({ error: "Sem permissão para expedição" });
    }
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        orderItemId: z.string(),
        delta: z.union([z.literal(1), z.literal(-1)]),
        reason: z.string().min(3).max(200),
      })
      .safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "Informe item, ajuste e motivo." });
    }
    try {
      return await adjustExpeditionItem({
        auth,
        orderId: id,
        orderItemId: body.data.orderItemId,
        delta: body.data.delta,
        reason: body.data.reason,
      });
    } catch (e) {
      return sendExpeditionError(reply, e);
    }
  });

  app.post("/expedition/orders/:id/complete", async (req, reply) => {
    const auth = req.auth!;
    if (
      !(await canWriteEffective(auth.organizationId, auth.role, "expedition"))
    ) {
      return reply.status(403).send({ error: "Sem permissão para expedição" });
    }
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      return await completeExpedition(auth, id);
    } catch (e) {
      return sendExpeditionError(reply, e);
    }
  });

  app.patch("/expedition/orders/:id/volumes", async (req, reply) => {
    const auth = req.auth!;
    if (
      !(await canWriteEffective(auth.organizationId, auth.role, "expedition"))
    ) {
      return reply.status(403).send({ error: "Sem permissão para expedição" });
    }
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ volumeQty: z.number().int() }).safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "Informe a quantidade de volumes." });
    }
    try {
      return await setExpeditionVolumes({
        auth,
        orderId: id,
        volumeQty: body.data.volumeQty,
      });
    } catch (e) {
      return sendExpeditionError(reply, e);
    }
  });

  app.post("/expedition/orders/:id/ship", async (req, reply) => {
    const auth = req.auth!;
    if (
      !(await canWriteEffective(auth.organizationId, auth.role, "expedition"))
    ) {
      return reply.status(403).send({ error: "Sem permissão para expedição" });
    }
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      return await markExpeditionShipped(auth, id);
    } catch (e) {
      return sendExpeditionError(reply, e);
    }
  });

  app.get("/expedition/orders/:id/label.pdf", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const q = z
      .object({
        volume: z.coerce.number().int().min(1).optional(),
        widthMm: z.coerce.number().optional(),
        heightMm: z.coerce.number().optional(),
      })
      .safeParse(req.query);
    const volumeIndex = q.success ? (q.data.volume ?? 1) : 1;
    try {
      await getExpeditionOrder(auth, id);
      await recordLabelPrint({ auth, orderId: id, volumeIndex });
      const pdf = await buildExpeditionLabelPdf({
        organizationId: auth.organizationId,
        orderId: id,
        volumeIndex,
        size: parseLabelSize(
          q.success ? q.data.widthMm : undefined,
          q.success ? q.data.heightMm : undefined,
        ),
      });
      return reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `inline; filename="etiqueta-pedido-${volumeIndex}.pdf"`,
        )
        .send(pdf);
    } catch (e) {
      return sendExpeditionError(reply, e);
    }
  });
};
