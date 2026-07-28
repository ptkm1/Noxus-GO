import { getPlanDefinition, isPlanId, listPlans } from "@pedidos/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const SITE_URL =
  process.env.SITE_PUBLIC_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3001";
const APP_URL = process.env.WEB_PUBLIC_URL?.trim() || "http://localhost:5173";

const checkoutBody = z.object({
  planId: z.string().min(1),
  email: z
    .string()
    .email()
    .transform((e) => e.trim().toLowerCase()),
  companyName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  document: z.string().trim().optional(),
  organizationId: z.string().trim().optional(),
});

/**
 * Billing público (landing) + leitura de planos.
 * Checkout é stub: persiste intent + payload pronto para Stripe/MP.
 */
export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/plans", async () => ({
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

  app.post("/checkout-intent", async (req, reply) => {
    const parsed = checkoutBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const { planId, email, companyName, phone, document, organizationId } =
      parsed.data;
    if (!isPlanId(planId)) {
      return reply.status(400).send({ error: "Plano inválido" });
    }

    if (organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!org) {
        return reply.status(400).send({ error: "Organização inválida" });
      }
    }

    const def = getPlanDefinition(planId);
    const intentIdPlaceholder = "pending";

    const checkout = {
      mode: "subscription" as const,
      interval: "month" as const,
      planId: def.id,
      planName: def.name,
      amountBrl: def.monthlyPriceBrl,
      currency: "BRL" as const,
      customer: {
        email,
        name: companyName,
        phone: phone ?? null,
        document: document ?? null,
      },
      metadata: {
        organizationId: organizationId ?? null,
        intentId: intentIdPlaceholder,
        planId: def.id,
      },
      successUrl: `${SITE_URL}/checkout/sucesso?plan=${def.id}`,
      cancelUrl: `${SITE_URL}/#planos`,
      appUrl: APP_URL,
      // provider adapter: criar sessão Stripe/MP com este objeto
      provider: "none" as const,
    };

    const intent = await prisma.checkoutIntent.create({
      data: {
        organizationId: organizationId ?? null,
        planId: def.id,
        email,
        companyName,
        phone: phone ?? null,
        document: document ?? null,
        checkoutPayload: {
          ...checkout,
          metadata: { ...checkout.metadata, intentId: "will-set" },
        },
        status: "pending",
      },
    });

    const checkoutFinal = {
      ...checkout,
      metadata: {
        ...checkout.metadata,
        intentId: intent.id,
      },
    };

    await prisma.checkoutIntent.update({
      where: { id: intent.id },
      data: { checkoutPayload: checkoutFinal },
    });

    return {
      intentId: intent.id,
      message:
        "Pedido recebido. Em breve redirecionaremos ao pagamento online.",
      checkout: checkoutFinal,
    };
  });
};
