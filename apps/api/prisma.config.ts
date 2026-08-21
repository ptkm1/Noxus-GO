import { defineConfig } from "prisma/config";
import {
  migrateDatasourceHost,
  resolveMigrateDatabaseUrl,
} from "./prisma-direct-url.ts";

/**
 * Prisma 7: datasource.url neste ficheiro é só para o CLI (migrate, studio, db push).
 * O runtime da API usa DATABASE_URL (pooler) via adapter em src/db.ts — não lê este config.
 *
 * Sempre força host direto (sem -pooler / pgbouncer). Se DIRECT_URL no Render estiver
 * copiado da URL pooled, ainda assim o migrate não usa o pooler.
 */
const migrateUrl = resolveMigrateDatabaseUrl();
console.error(`[prisma.config] migrate host: ${migrateDatasourceHost(migrateUrl)}`);

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrateUrl,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "pnpm exec tsx apps/api/prisma/seed.ts",
  },
});
