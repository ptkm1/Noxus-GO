import type { BankingProviderKind } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { BankingProviderError } from "../services/banking/banking-provider.js";
import {
  createReceivable,
  disconnectBankConnection,
  listBankConnections,
  listCustomerReceivables,
  reconcileOpenReceivables,
  sanitizeConnectionForClient,
  serializeReceivable,
  syncReceivable,
  upsertBankConnection,
} from "../services/banking/receivable-service.js";
import { checkCustomer } from "../services/credit.js";
import { sendZodError } from "../util/zod-reply.js";

const providerEnum = z.enum(["ITAU", "BB", "SANTANDER"]);

/**
 * Rotas admin de conciliação bancária / recebíveis (prefixo /admin).
 * Auth/ACL herdados do plugin admin. Secrets nunca são devolvidos ao client.
 */
export const bankingAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/banking/connections", async (req) => {
    const auth = req.auth!;
    return listBankConnections(auth.organizationId);
  });

  app.post("/banking/connections", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        provider: providerEnum,
        metadata: z
          .object({
            agency: z.string().optional(),
            account: z.string().optional(),
            wallet: z.string().optional(),
            covenantCode: z.string().optional(),
            workspaceId: z.string().optional(),
            beneficiaryCode: z.string().optional(),
            environment: z.enum(["sandbox", "production"]).optional(),
            label: z.string().optional(),
          })
          .passthrough()
          .optional(),
        credentialsEnvPrefix: z.string().min(3).max(80).nullable().optional(),
        secrets: z.record(z.string(), z.string()).optional(),
        webhookSecret: z.string().min(8).max(200).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return sendZodError(reply, body.error, req);

    if (
      body.data.secrets &&
      Object.keys(body.data.secrets).length > 0 &&
      process.env.NODE_ENV === "production" &&
      process.env.BANKING_ALLOW_BODY_SECRETS !== "1"
    ) {
      return reply.status(400).send({
        error:
          "Em produção use credentialsEnvPrefix (env). Defina BANKING_ALLOW_BODY_SECRETS=1 só se necessário.",
      });
    }

    return upsertBankConnection({
      organizationId: auth.organizationId,
      provider: body.data.provider as BankingProviderKind,
      metadata: body.data.metadata,
      credentialsEnvPrefix: body.data.credentialsEnvPrefix,
      secrets: body.data.secrets,
      webhookSecret: body.data.webhookSecret,
    });
  });

  app.patch("/banking/connections/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const existing = await prisma.bankConnection.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    const body = z
      .object({
        metadata: z.record(z.string(), z.unknown()).optional(),
        credentialsEnvPrefix: z.string().min(3).max(80).nullable().optional(),
        secrets: z.record(z.string(), z.string()).optional(),
        webhookSecret: z.string().min(8).max(200).nullable().optional(),
        status: z
          .enum(["PENDING_SETUP", "ACTIVE", "ERROR", "DISCONNECTED"])
          .optional(),
      })
      .safeParse(req.body);
    if (!body.success) return sendZodError(reply, body.error, req);

    return upsertBankConnection({
      organizationId: auth.organizationId,
      provider: existing.provider,
      metadata: body.data.metadata as Record<string, unknown> | undefined,
      credentialsEnvPrefix: body.data.credentialsEnvPrefix,
      secrets: body.data.secrets,
      webhookSecret: body.data.webhookSecret,
      status: body.data.status,
    });
  });

  app.post("/banking/connections/:id/disconnect", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const row = await disconnectBankConnection(auth.organizationId, id);
    if (!row) return reply.status(404).send({ error: "Não encontrado" });
    return row;
  });

  app.post("/banking/connections/:id/sync", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const existing = await prisma.bankConnection.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    const result = await reconcileOpenReceivables({
      organizationId: auth.organizationId,
      syncRemote: true,
      limit: 30,
    });
    const updated = await prisma.bankConnection.update({
      where: { id },
      data: { lastSyncAt: new Date() },
    });
    return {
      connection: sanitizeConnectionForClient(updated),
      reconcile: result,
    };
  });

  app.get("/receivables", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({
        customerId: z.string().optional(),
        status: z
          .enum(["PENDING", "PAID", "PARTIALLY_PAID", "OVERDUE", "CANCELLED"])
          .optional(),
      })
      .safeParse(req.query);
    const rows = await prisma.receivable.findMany({
      where: {
        organizationId: auth.organizationId,
        ...(q.success && q.data.customerId
          ? { customerId: q.data.customerId }
          : {}),
        ...(q.success && q.data.status ? { status: q.data.status } : {}),
      },
      orderBy: { dueDate: "asc" },
      take: 200,
      include: {
        bankConnection: {
          select: { id: true, provider: true, status: true },
        },
        customer: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => ({
      ...serializeReceivable(r),
      customerName: r.customer.name,
    }));
  });

  app.post("/receivables", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        customerId: z.string().min(1),
        bankConnectionId: z.string().min(1),
        orderId: z.string().optional().nullable(),
        amount: z.number().positive(),
        dueDate: z.string().datetime(),
        nossoNumero: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        registerAtBank: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return sendZodError(reply, body.error, req);

    try {
      const row = await createReceivable({
        organizationId: auth.organizationId,
        customerId: body.data.customerId,
        bankConnectionId: body.data.bankConnectionId,
        orderId: body.data.orderId,
        amount: body.data.amount,
        dueDate: new Date(body.data.dueDate),
        nossoNumero: body.data.nossoNumero,
        description: body.data.description,
        registerAtBank: body.data.registerAtBank ?? false,
      });
      return serializeReceivable(row);
    } catch (err) {
      if (err instanceof BankingProviderError) {
        return reply.status(err.status ?? 400).send({
          error: err.message,
          code: err.code,
        });
      }
      throw err;
    }
  });

  app.post("/receivables/:id/sync", async (req, reply) => {
    const auth = req.auth!;
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    try {
      const row = await syncReceivable(auth.organizationId, id);
      return serializeReceivable(row);
    } catch (err) {
      if (err instanceof BankingProviderError) {
        return reply.status(err.status ?? 400).send({
          error: err.message,
          code: err.code,
        });
      }
      throw err;
    }
  });

  app.get("/customers/:customerId/receivables", async (req, reply) => {
    const auth = req.auth!;
    const { customerId } = z
      .object({ customerId: z.string().min(1) })
      .parse(req.params);
    const cust = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: auth.organizationId },
      select: { id: true },
    });
    if (!cust) return reply.status(404).send({ error: "Não encontrado" });
    const rows = await listCustomerReceivables(
      auth.organizationId,
      customerId,
    );
    return rows.map(serializeReceivable);
  });

  app.get("/customers/:customerId/credit-check", async (req, reply) => {
    const auth = req.auth!;
    const { customerId } = z
      .object({ customerId: z.string().min(1) })
      .parse(req.params);
    const cust = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: auth.organizationId },
      select: { id: true },
    });
    if (!cust) return reply.status(404).send({ error: "Não encontrado" });
    return checkCustomer(auth.organizationId, customerId);
  });
};
