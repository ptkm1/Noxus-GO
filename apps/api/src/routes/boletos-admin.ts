import type { ReceivableStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { BankingProviderError } from "../services/banking/banking-provider.js";
import {
  cancelBoleto,
  emitAllPendingBoletos,
  emitBoletosForOrder,
  getBoletoDetail,
  getBoletoPdfBuffer,
  getBoletosSummary,
  listBoletos,
  listEligibleOrdersForBoletos,
  patchBoleto,
  reissueBoleto,
  syncBoletoWithEvent,
} from "../services/banking/boleto-emission-service.js";
import { listBankConnections } from "../services/banking/receivable-service.js";
import { sendZodError } from "../util/zod-reply.js";

const statusEnum = z.enum([
  "PENDING",
  "PROCESSING",
  "PAID",
  "PARTIALLY_PAID",
  "OVERDUE",
  "CANCELLED",
  "ERROR",
]);

function replyBankingError(
  reply: { status: (c: number) => { send: (b: unknown) => unknown } },
  err: unknown,
) {
  if (err instanceof BankingProviderError) {
    return reply.status(err.httpStatus ?? 400).send({
      error: err.message,
      code: err.code,
    });
  }
  throw err;
}

/**
 * Rotas admin de emissão de boletos (prefixo /admin).
 * Resource: `boletos` (adminPathToResource).
 */
export const boletosAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/boletos/eligible-orders", async (req) => {
    const auth = req.auth!;
    return listEligibleOrdersForBoletos(auth.organizationId);
  });

  app.get("/boletos/summary", async (req) => {
    const auth = req.auth!;
    return getBoletosSummary(auth.organizationId);
  });

  app.get("/boletos", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({
        status: statusEnum.optional(),
        customerId: z.string().optional(),
        orderId: z.string().optional(),
        q: z.string().optional(),
        take: z.coerce.number().int().min(1).max(300).optional(),
      })
      .safeParse(req.query);
    return listBoletos(auth.organizationId, {
      status: q.success ? (q.data.status as ReceivableStatus | undefined) : undefined,
      customerId: q.success ? q.data.customerId : undefined,
      orderId: q.success ? q.data.orderId : undefined,
      q: q.success ? q.data.q : undefined,
      take: q.success ? q.data.take : undefined,
    });
  });

  app.post("/boletos/emit", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        orderId: z.string().min(1),
        bankConnectionId: z.string().min(1).optional(),
        installmentIndex: z.number().int().min(1).optional(),
        instructions: z.string().max(500).nullable().optional(),
        interestPercent: z.number().min(0).max(100).nullable().optional(),
        finePercent: z.number().min(0).max(100).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return sendZodError(reply, body.error, req);

    try {
      const bankConnectionId =
        body.data.bankConnectionId ??
        (await defaultActiveBankId(auth.organizationId));
      if (!bankConnectionId) {
        return reply.status(400).send({
          error: "Nenhuma conexão bancária ACTIVE. Configure em Integrações bancárias.",
        });
      }
      const result = await emitBoletosForOrder({
        organizationId: auth.organizationId,
        actorUserId: auth.sub,
        bankConnectionId,
        orderId: body.data.orderId,
        installmentIndex: body.data.installmentIndex,
        instructions: body.data.instructions,
        interestPercent: body.data.interestPercent,
        finePercent: body.data.finePercent,
      });
      return {
        ...result,
        openPdf: result.openPdfIds.length > 0,
      };
    } catch (err) {
      return replyBankingError(reply, err);
    }
  });

  app.post("/boletos/emit-all", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        bankConnectionId: z.string().min(1).optional(),
        orderIds: z.array(z.string().min(1)).optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return sendZodError(reply, body.error, req);

    try {
      const bankConnectionId =
        body.data.bankConnectionId ??
        (await defaultActiveBankId(auth.organizationId));
      if (!bankConnectionId) {
        return reply.status(400).send({
          error: "Nenhuma conexão bancária ACTIVE.",
        });
      }
      const result = await emitAllPendingBoletos({
        organizationId: auth.organizationId,
        actorUserId: auth.sub,
        bankConnectionId,
        orderIds: body.data.orderIds,
      });
      const openPdfIds = result.results.flatMap((r) => r.openPdfIds);
      return { ...result, openPdfIds, openPdf: openPdfIds.length > 0 };
    } catch (err) {
      return replyBankingError(reply, err);
    }
  });

  app.get("/boletos/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const row = await getBoletoDetail(auth.organizationId, id);
    if (!row) return reply.status(404).send({ error: "Não encontrado" });
    return row;
  });

  app.get("/boletos/:id/pdf", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    try {
      const pdf = await getBoletoPdfBuffer({
        organizationId: auth.organizationId,
        receivableId: id,
        actorUserId: auth.sub,
        action: "PDF_VIEW",
      });
      return reply
        .header("Content-Type", pdf.contentType)
        .header(
          "Content-Disposition",
          `inline; filename="${pdf.filename}"`,
        )
        .send(pdf.buffer);
    } catch (err) {
      return replyBankingError(reply, err);
    }
  });

  app.post("/boletos/:id/sync", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    try {
      return await syncBoletoWithEvent({
        organizationId: auth.organizationId,
        receivableId: id,
        actorUserId: auth.sub,
      });
    } catch (err) {
      return replyBankingError(reply, err);
    }
  });

  app.patch("/boletos/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        dueDate: z.string().datetime().optional(),
        amount: z.number().positive().optional(),
        instructions: z.string().max(500).nullable().optional(),
        interestPercent: z.number().min(0).max(100).nullable().optional(),
        finePercent: z.number().min(0).max(100).nullable().optional(),
        discountAmount: z.number().min(0).nullable().optional(),
        discountUntil: z.string().datetime().nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return sendZodError(reply, body.error, req);

    try {
      return await patchBoleto({
        organizationId: auth.organizationId,
        receivableId: id,
        actorUserId: auth.sub,
        patch: {
          dueDate: body.data.dueDate
            ? new Date(body.data.dueDate)
            : undefined,
          amount: body.data.amount,
          instructions: body.data.instructions,
          interestPercent: body.data.interestPercent,
          finePercent: body.data.finePercent,
          discountAmount: body.data.discountAmount,
          discountUntil:
            body.data.discountUntil === undefined
              ? undefined
              : body.data.discountUntil
                ? new Date(body.data.discountUntil)
                : null,
        },
      });
    } catch (err) {
      return replyBankingError(reply, err);
    }
  });

  app.post("/boletos/:id/cancel", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z
      .object({ reason: z.string().max(500).optional() })
      .safeParse(req.body ?? {});
    if (!body.success) return sendZodError(reply, body.error, req);
    try {
      return await cancelBoleto({
        organizationId: auth.organizationId,
        receivableId: id,
        actorUserId: auth.sub,
        reason: body.data.reason,
      });
    } catch (err) {
      return replyBankingError(reply, err);
    }
  });

  app.post("/boletos/:id/reissue", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        bankConnectionId: z.string().min(1).optional(),
        dueDate: z.string().datetime().optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return sendZodError(reply, body.error, req);
    try {
      const result = await reissueBoleto({
        organizationId: auth.organizationId,
        receivableId: id,
        actorUserId: auth.sub,
        bankConnectionId: body.data.bankConnectionId,
        dueDate: body.data.dueDate
          ? new Date(body.data.dueDate)
          : undefined,
      });
      return { ...result, openPdf: result.openPdfIds.length > 0 };
    } catch (err) {
      return replyBankingError(reply, err);
    }
  });
};

async function defaultActiveBankId(
  organizationId: string,
): Promise<string | null> {
  const list = await listBankConnections(organizationId);
  const active = list.find((c) => c.status === "ACTIVE");
  return active?.id ?? null;
}
