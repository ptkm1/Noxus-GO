import { defineConfig } from "prisma/config";

/**
 * Migrate precisa de conexão direta (sem pgBouncer).
 * Neon pooled:  ep-xxx-pooler.region.aws.neon.tech
 * Neon direct:  ep-xxx.region.aws.neon.tech
 */
function migrateDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct) return direct;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL (ou DIRECT_URL) não definido");
  }
  return url.replace("-pooler.", ".");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrateDatabaseUrl(),
  },
  migrations: {
    seed: "pnpm exec tsx apps/api/prisma/seed.ts",
  },
});
