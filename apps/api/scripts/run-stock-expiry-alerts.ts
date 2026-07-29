/**
 * Executa o job de alertas de validade (dedupe + push ADMIN/MANAGER).
 *
 * Uso:
 *   pnpm exec dotenv -e apps/api/.env -- tsx apps/api/scripts/run-stock-expiry-alerts.ts
 *   pnpm exec dotenv -e apps/api/.env -- tsx apps/api/scripts/run-stock-expiry-alerts.ts --org=<organizationId>
 */
import { prisma } from "../src/db.js";
import { runStockExpiryAlerts } from "../src/services/stock-expiry-alerts.js";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}

async function main() {
  const organizationId = argValue("org");
  console.log(
    organizationId
      ? `Rodando stock-expiry para org ${organizationId}…`
      : "Rodando stock-expiry para todas as orgs…",
  );
  const first = await runStockExpiryAlerts({ organizationId });
  console.log("1ª execução:", first);
  const second = await runStockExpiryAlerts({ organizationId });
  console.log("2ª execução (deve ter newAlerts=0 se dedupe ok):", second);
  if (second.newAlerts !== 0) {
    console.error("Falha no dedupe: 2ª execução ainda criou alertas.");
    process.exitCode = 1;
  } else {
    console.log("OK: dedupe sem spam na 2ª execução.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
