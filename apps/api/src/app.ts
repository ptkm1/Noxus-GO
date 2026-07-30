import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyRequest } from "fastify";
import { verifyAccessToken, type AccessPayload } from "./auth/jwt.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { asaasWebhookRoutes, billingRoutes } from "./routes/billing.js";
import { integrationsRoutes } from "./routes/integrations.js";
import { jobsRoutes } from "./routes/jobs.js";
import { sellerRoutes } from "./routes/seller.js";

const API_PREFIX = "/api/v1";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AccessPayload;
  }
}

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "content-type",
      "authorization",
      "x-cron-secret",
      "asaas-access-token",
      "ngrok-skip-browser-warning",
    ],
  });

  await app.register(websocket);

  // Hook na raiz: plugins irmãos não herdam hooks de outro `register()` encapsulado.
  app.addHook("onRequest", async (request: FastifyRequest) => {
    const h = request.headers.authorization;
    if (!h?.startsWith("Bearer ")) return;
    const token = h.slice(7);
    try {
      request.auth = verifyAccessToken(token);
    } catch {
      /* rota pública ou 401 na rota protegida */
    }
  });

  const v1 = API_PREFIX;

  await app.register(asaasWebhookRoutes, { prefix: `${v1}/webhooks` });

  await app.register(
    async (r) => {
      await r.register(authRoutes, { prefix: "/auth" });
      await r.register(billingRoutes, { prefix: "/billing" });
      await r.register(integrationsRoutes, { prefix: "/integrations" });
      await r.register(jobsRoutes, { prefix: "/jobs" });
    },
    { prefix: v1 },
  );

  await app.register(
    async (r) => {
      await r.register(adminRoutes);
    },
    { prefix: `${v1}/admin` },
  );

  await app.register(
    async (r) => {
      await r.register(sellerRoutes);
    },
    { prefix: `${v1}/seller` },
  );

  app.get("/health", async () => ({ ok: true }));

  return app;
}
