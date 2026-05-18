import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { fetchCnpjFromBrasilApi } from "../services/cnpj-brasilapi.js";

const digitsParam = z.object({
  digits: z.string().regex(/^\d{14}$/, "Informe exatamente 14 dígitos"),
});

/** Rotas públicas (sem JWT): proxy consulta CNPJ via BrasilAPI. */
export const integrationsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cnpj/:digits", async (req, reply) => {
    const parsed = digitsParam.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "CNPJ inválido",
        details: parsed.error.flatten(),
      });
    }

    try {
      const data = await fetchCnpjFromBrasilApi(parsed.data.digits);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao consultar CNPJ.";
      const lower = msg.toLowerCase();
      if (lower.includes("não encontrado") || lower.includes("nao encontrado")) {
        return reply.status(404).send({ error: msg });
      }
      app.log.warn({ err }, "integrations/cnpj falhou");
      return reply.status(502).send({ error: msg });
    }
  });
};
