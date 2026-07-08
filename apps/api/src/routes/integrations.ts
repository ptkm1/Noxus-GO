import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync } from "fastify";
import { isValidCnpj } from "@pedidos/shared";
import { z } from "zod";
import { fetchCnpj, isCnpjProviderConfigured, readCnpjProvider } from "../services/cnpj/index.js";

const digitsParam = z.object({
  digits: z.string().regex(/^\d{14}$/, "Informe exatamente 14 dígitos"),
});

/** Rotas públicas (sem JWT): proxy consulta CNPJ via provedor configurável. */
export const integrationsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(rateLimit, {
    max: 10,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.ip,
  });

  app.get("/cnpj/:digits", async (req, reply) => {
    const parsed = digitsParam.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "CNPJ inválido",
        details: parsed.error.flatten(),
      });
    }

    if (!isValidCnpj(parsed.data.digits)) {
      return reply.status(400).send({ error: "CNPJ inválido (dígitos verificadores incorretos)." });
    }

    const provider = readCnpjProvider();
    if (!isCnpjProviderConfigured(provider)) {
      app.log.error({ provider }, "integrations/cnpj: provedor não configurado");
      return reply.status(503).send({ error: "Consulta de CNPJ temporariamente indisponível." });
    }

    try {
      const data = await fetchCnpj(parsed.data.digits);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao consultar CNPJ.";
      const lower = msg.toLowerCase();
      if (lower.includes("não encontrado") || lower.includes("nao encontrado")) {
        return reply.status(404).send({ error: msg });
      }
      app.log.warn({ err, provider }, "integrations/cnpj falhou");
      return reply.status(502).send({ error: msg });
    }
  });
};
