import { buildApp } from "./app.js";
import { prisma } from "./db.js";
import "./load-env.js";
import { scheduleCustomerInactivationCron } from "./services/customer-inactivation-cron.js";
import { scheduleFiscalTransmitCron } from "./services/fiscal-transmit-cron.js";
import { scheduleMorningBriefCron } from "./services/morning-brief-cron.js";
import { scheduleStockExpiryCron } from "./services/stock-expiry-cron.js";

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

function requireJwtEnv() {
  const a = process.env.JWT_SECRET?.trim();
  const r = process.env.JWT_REFRESH_SECRET?.trim();
  if (!a || !r) {
    console.error(
      "[pedidos-api] JWT_SECRET e JWT_REFRESH_SECRET são obrigatórios em apps/api/.env.",
    );
    process.exit(1);
  }
  if (a.length < 16 || r.length < 16) {
    console.error(
      "[pedidos-api] Cada segredo JWT deve ter pelo menos 16 caracteres.",
    );
    process.exit(1);
  }
}

requireJwtEnv();

const app = await buildApp();

try {
  await app.listen({ port, host });
  const userCount = await prisma.user.count();
  app.log.info(
    `[db] ${userCount} utilizador(es). Se for 0, na raiz do repo: pnpm db:seed`,
  );
  app.log.info(`API http://${host}:${port}`);
  scheduleStockExpiryCron(app.log);
  scheduleMorningBriefCron(app.log);
  scheduleFiscalTransmitCron(app.log);
  scheduleCustomerInactivationCron(app.log);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
