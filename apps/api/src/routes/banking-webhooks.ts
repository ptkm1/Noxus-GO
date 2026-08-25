import type { FastifyPluginAsync } from "fastify";
import {
  parseProviderParam,
  processBankingWebhook,
} from "../services/banking/webhook-processor.js";

/**
 * Webhooks públicos de cobrança bancária (boletos dos clientes).
 * Separado de /webhooks/asaas (assinatura SaaS Pedix).
 *
 * Auth: token por conexão (x-banking-webhook-token) ou BANKING_{PROVIDER}_WEBHOOK_TOKEN.
 * Santander: mTLS no edge + token opcional.
 */
export const bankingWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.get("/banking/:provider", async (req) => {
    const provider = parseProviderParam(
      (req.params as { provider?: string }).provider ?? "",
    );
    return { ok: true, webhook: "banking", provider };
  });

  app.post("/banking/:provider", async (req, reply) => {
    const provider = parseProviderParam(
      (req.params as { provider?: string }).provider ?? "",
    );
    if (!provider) {
      return reply.status(400).send({ error: "Provedor inválido" });
    }

    const q = req.query as { connectionId?: string };
    try {
      const result = await processBankingWebhook({
        provider,
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body,
        rawBody:
          typeof req.body === "string"
            ? req.body
            : JSON.stringify(req.body ?? {}),
        connectionId: q.connectionId ?? null,
      });
      return result;
    } catch (err) {
      const status =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode: number }).statusCode)
          : 500;
      if (status === 401) {
        return reply.status(401).send({ error: "Não autorizado" });
      }
      req.log.error({ err, provider }, "banking webhook processing failed");
      return reply.status(500).send({ error: "Falha ao processar webhook" });
    }
  });
};
