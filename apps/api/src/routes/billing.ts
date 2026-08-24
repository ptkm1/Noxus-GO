import rateLimit from "@fastify/rate-limit";
import { isPlanId, listPlans } from "@pedidos/shared";
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
    createCheckoutForRegisteredOrg,
    createSubscriptionIntent,
    getOpenCheckoutForOrg,
    getPublicIntentStatus,
    paySubscriptionIntentWithCard,
    retrySubscriptionCheckout,
} from "../services/billing/subscription-intent-service.js";
import { subscriptionCardPayBodySchema } from "../services/billing/card-pay-validation.js";
import { reconcileOrganizationBilling } from "../services/billing/reconcile-asaas-billing.js";
import { resolveClientRemoteIp } from "../util/client-ip.js";
import { getAuth } from "../util/guards.js";
import { sendZodError } from "../util/zod-reply.js";

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
        sellerSeatPriceBrl: p.sellerSeatPriceBrl,
        extraAdminSeatPriceBrl: p.extraAdminSeatPriceBrl,
        features: p.features,
        marketingFeatures: p.marketingFeatures,
        marketingNote: p.marketingNote ?? null,
        limits: p.limits,
        highlighted: Boolean(p.highlighted),
      })),
    }));

    publicApp.post("/subscription-intents", async (req, reply) => {
      const parsed = intentBody.safeParse(req.body);
      if (!parsed.success) {
        return sendZodError(reply, parsed.error, req);
      }
      try {
        const result = await createSubscriptionIntent(parsed.data);
        return {
          intentId: result.intentId,
          checkoutUrl: result.checkoutUrl,
          message: "Prossiga com o pagamento no formulário seguro.",
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
          message: "Prossiga com o pagamento no formulário seguro.",
        };
      } catch (err) {
        const { status, body } = httpErr(err);
        return reply.status(status).send(body);
      }
    });
  });

  await app.register(async (pollApp) => {
    await pollApp.register(rateLimit, {
      max: 60,
      timeWindow: "1 minute",
      keyGenerator: (req) => req.ip,
    });
    pollApp.get("/subscription-intents/:id/status", async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const status = await getPublicIntentStatus(id);
      if (!status) return reply.status(404).send({ error: "Não encontrado" });
      return status;
    });
  });

  await app.register(async (payApp) => {
    await payApp.register(rateLimit, {
      max: 15,
      timeWindow: "1 minute",
      keyGenerator: (req) => req.ip,
    });
    payApp.post("/subscription-intents/:id/pay", async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const parsed = subscriptionCardPayBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return sendZodError(
          reply,
          parsed.error,
          req,
          "Dados do cartão inválidos",
        );
      }

      const remoteIp = resolveClientRemoteIp(req);
      let auth: { organizationId: string; userId: string; role: string } | undefined;
      if (req.auth) {
        auth = {
          organizationId: req.auth.organizationId,
          userId: req.auth.sub,
          role: req.auth.role,
        };
      }

      try {
        const result = await paySubscriptionIntentWithCard(
          id,
          parsed.data,
          remoteIp,
          auth,
        );
        return {
          intentId: result.intentId,
          status: result.status,
          message:
            result.status === "ACTIVE"
              ? "Pagamento confirmado."
              : "Pagamento em processamento. Aguarde a confirmação.",
        };
      } catch (err) {
        const { status, body } = httpErr(err);
        req.log.warn({ err: body.code, intentId: id }, "card pay failed");
        return reply.status(status).send(body);
      }
    });
  });

  app.get("/checkout/open", async (req, reply) => {
    const auth = getAuth(req, reply);
    if (!auth) return;
    if (!requireAdmin(reply, auth)) return;
    const org = await prisma.organization.findUnique({
      where: { id: auth.organizationId },
      select: { accessStatus: true },
    });
    const intent = await getOpenCheckoutForOrg(auth.organizationId);
    return {
      intent,
      accessStatus: org?.accessStatus ?? null,
    };
  });

  const checkoutBody = z.object({
    planId: z.string().min(1),
  });

  app.post("/checkout", async (req, reply) => {
    const auth = getAuth(req, reply);
    if (!auth) return;
    if (!requireAdmin(reply, auth)) return;
    const parsed = checkoutBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Plano inválido" });
    }
    if (!isPlanId(parsed.data.planId)) {
      return reply.status(400).send({ error: "Plano inválido" });
    }
    const planId = parsed.data.planId;

    const org = await prisma.organization.findUnique({
      where: { id: auth.organizationId },
      include: { subscription: true },
    });
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
    });
    if (!org || !user) {
      return reply.status(404).send({ error: "Organização não encontrada" });
    }

    const currentSub = org.subscription;
    const isPaidActive =
      org.accessStatus === "ACTIVE" && currentSub?.status === "ACTIVE";
    if (isPaidActive && currentSub?.planId === planId) {
      return reply.status(400).send({
        error: "Você já está neste plano.",
        code: "SAME_PLAN",
      });
    }

    const document = org.document || org.cnpj;
    if (!document) {
      return reply
        .status(400)
        .send({ error: "CNPJ da empresa é obrigatório para o pagamento" });
    }

    const lockAccessUntilPaid = org.accessStatus === "PENDING_PAYMENT";

    try {
      const result = await createCheckoutForRegisteredOrg({
        organizationId: org.id,
        ownerUserId: user.id,
        planId,
        companyName: org.displayName || org.name,
        adminName: user.name,
        email: user.email,
        document,
        lockAccessUntilPaid,
      });
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

  const reconcileBody = z.object({
    dryRun: z.boolean().optional(),
  });

  app.post("/reconcile", async (req, reply) => {
    const auth = getAuth(req, reply);
    if (!auth) return;
    if (!requireAdmin(reply, auth)) return;

    const parsed = reconcileBody.safeParse(req.body ?? {});
    const dryRun = parsed.success ? (parsed.data.dryRun ?? false) : false;

    try {
      const report = await reconcileOrganizationBilling(auth.organizationId, {
        dryRun,
      });
      if (!dryRun) {
        await prisma.auditLog.create({
          data: {
            organizationId: auth.organizationId,
            userId: auth.sub,
            action: "subscription.reconciled",
            entityType: "OrganizationSubscription",
            entityId: auth.organizationId,
            metadata: {
              fixed: report.fixed,
              issues: report.issues,
            },
          },
        });
      }
      return report;
    } catch (err) {
      const { status, body } = httpErr(err);
      return reply.status(status).send(body);
    }
  });
};

export const asaasWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.get("/asaas", async () => ({ ok: true, webhook: "asaas" }));

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
