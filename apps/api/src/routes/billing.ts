import rateLimit from "@fastify/rate-limit";
import { listPlans } from "@pedidos/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/org-roles.js";
import { prisma } from "../db.js";
import { readAsaasConfig } from "../services/billing/asaas/asaas-config.js";
import { createAsaasPaymentGateway } from "../services/billing/asaas/asaas-payment-gateway.js";
import {
  processAsaasWebhook,
  validateAsaasWebhookToken,
} from "../services/billing/asaas/webhook-processor.js";
import {
  createSubscriptionIntent,
  getPublicIntentStatus,
  retrySubscriptionCheckout,
} from "../services/billing/subscription-intent-service.js";
import { getAuth } from "../util/guards.js";

const intentBody = z.object({
  planId: z.string().min(1),
  companyName: z.string().trim().min(1),
  adminName: z.string().trim().min(1),
  email: z
    .string()
    .email()
    .transform((e) => e.trim().toLowerCase()),
  phone: z.string().trim().optional(),
  document: z.string().trim().min(11),
  termsAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
});

function httpErr(err: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  const e = err as {
    message?: string;
    code?: string;
    http?: number;
    intentId?: string;
  };
  return {
    status: e.http ?? 500,
    body: {
      error: e.message || "Erro interno",
      code: e.code,
      intentId: e.intentId,
    },
  };
}

export const billingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(async (publicApp) => {
    await publicApp.register(rateLimit, {
      max: 20,
      timeWindow: "1 minute",
      keyGenerator: (req) => req.ip,
    });

    publicApp.get("/plans", async () => ({
      plans: listPlans().map((p) => ({
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        description: p.description,
        monthlyPriceBrl: p.monthlyPriceBrl,
        features: p.features,
        limits: p.limits,
        highlighted: Boolean(p.highlighted),
      })),
    }));

    publicApp.post("/subscription-intents", async (req, reply) => {
      const parsed = intentBody.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Dados inválidos", details: parsed.error.flatten() });
      }
      try {
        const result = await createSubscriptionIntent(parsed.data);
        return {
          intentId: result.intentId,
          checkoutUrl: result.checkoutUrl,
          message: "Redirecionando para o pagamento seguro...",
        };
      } catch (err) {
        const { status, body } = httpErr(err);
        req.log.warn(
          { err: body.code, intentId: body.intentId },
          "subscription-intent failed",
        );
        return reply.status(status).send(body);
      }
    });

    publicApp.post("/subscription-intents/:id/retry", async (req, reply) => {
      const id = (req.params as { id: string }).id;
      try {
        const result = await retrySubscriptionCheckout(id);
        return {
          intentId: result.intentId,
          checkoutUrl: result.checkoutUrl,
          message: "Redirecionando para o pagamento seguro...",
        };
      } catch (err) {
        const { status, body } = httpErr(err);
        return reply.status(status).send(body);
      }
    });

    publicApp.get("/subscription-intents/:id/status", async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const status = await getPublicIntentStatus(id);
      if (!status) return reply.status(404).send({ error: "Não encontrado" });
      return status;
    });
  });

  /** Stub legado — mantido para compatibilidade; preferir subscription-intents. */
  app.post("/checkout-intent", async (_req, reply) => {
    return reply.status(410).send({
      error: "Endpoint substituído. Use POST /billing/subscription-intents",
      code: "GONE",
    });
  });

  app.post("/cancel", async (req, reply) => {
    const auth = getAuth(req, reply);
    if (!auth) return;
    if (!requireAdmin(reply, auth)) return;

    const sub = await prisma.organizationSubscription.findUnique({
      where: { organizationId: auth.organizationId },
    });
    if (!sub) {
      return reply.status(404).send({ error: "Assinatura não encontrada" });
    }

    const cfg = readAsaasConfig();
    if (sub.provider === "asaas" && sub.providerSubscriptionId && cfg) {
      try {
        const gw = createAsaasPaymentGateway(cfg);
        await gw.cancelSubscription(sub.providerSubscriptionId);
      } catch (err) {
        req.log.warn(
          { err: err instanceof Error ? err.message : "cancel_failed" },
          "asaas cancel subscription",
        );
      }
    }

    await prisma.organizationSubscription.update({
      where: { organizationId: auth.organizationId },
      data: { cancelAtPeriodEnd: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: auth.organizationId,
        userId: auth.sub,
        action: "subscription.cancel_requested",
        entityType: "OrganizationSubscription",
        entityId: sub.id,
        metadata: { cancelAtPeriodEnd: true },
      },
    });

    return { ok: true, cancelAtPeriodEnd: true };
  });
};

export const asaasWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/asaas", async (req, reply) => {
    if (!validateAsaasWebhookToken(req.headers["asaas-access-token"])) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    try {
      const result = await processAsaasWebhook(
        (req.body ?? {}) as Parameters<typeof processAsaasWebhook>[0],
      );
      return { ...result, received: true };
    } catch (err) {
      req.log.error(
        { err: err instanceof Error ? err.message : "webhook_error" },
        "asaas webhook processing failed",
      );
      // Ainda 200 se possível após persistir — aqui falhou: 500 para retry Asaas
      return reply.status(500).send({ error: "processing_failed" });
    }
  });
};
