/**
 * Gera SQL de seed do catálogo fiscal a partir dos JSONs oficiais.
 * Uso: pnpm exec tsx apps/api/scripts/generate-fiscal-catalog-migration.ts
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inferCfopContexts,
  isFiscalCatalogType,
  normalizeCestCode,
  normalizeCfopCode,
  normalizeNcmCode,
  type FiscalCatalogType,
} from "@pedidos/shared";
import {
  defaultFiscalCatalogDataDir,
  parseFiscalCatalogJson,
} from "../src/services/fiscal/fiscal-catalog.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_DIR = path.resolve(
  __dirname,
  "../prisma/migrations/20260822020000_fiscal_catalog_seed",
);

function sqlStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlTs(iso: string | null | undefined): string {
  if (!iso) return "NULL";
  return `${sqlStr(iso)}::timestamptz`;
}

function normalizeCode(type: FiscalCatalogType, raw: string): string {
  switch (type) {
    case "NCM":
      return normalizeNcmCode(raw);
    case "CEST":
      return normalizeCestCode(raw);
    case "CFOP":
      return normalizeCfopCode(raw);
    default:
      return raw.trim().toUpperCase();
  }
}

async function main() {
  const dir = defaultFiscalCatalogDataDir();
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  const chunks: string[] = [
    `-- Seed do catálogo fiscal oficial (NCM, CFOP, CEST, CST, CSOSN, origem, PIS).`,
    `-- Idempotente: ON CONFLICT (type, code).`,
    ``,
  ];

  let total = 0;
  const batchSize = 200;

  for (const name of names) {
    const parsed = parseFiscalCatalogJson(
      JSON.parse(await readFile(path.join(dir, name), "utf8")),
    );
    if (!parsed || !isFiscalCatalogType(parsed.type)) continue;
    const type = parsed.type;
    const values: string[] = [];

    for (const entry of parsed.entries) {
      const code = normalizeCode(type, entry.code);
      const description = entry.description.trim();
      if (!code || !description) continue;
      if (type === "NCM" && code.length !== 8) continue;

      const metadata: Record<string, unknown> = { ...(entry.metadata ?? {}) };
      if (type === "CFOP" && !Array.isArray(metadata.contexts)) {
        metadata.contexts = inferCfopContexts(code, description);
      }

      values.push(
        `(gen_random_uuid(), ${sqlStr(type)}, ${sqlStr(code)}, ${sqlStr(description)}, ${
          entry.active !== false
        }, ${sqlTs(entry.validFrom)}, ${sqlTs(entry.validTo)}, ${sqlStr(
          JSON.stringify(metadata),
        )}::jsonb, ${sqlStr(parsed.sourceVersion)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      );
    }

    for (let i = 0; i < values.length; i += batchSize) {
      const slice = values.slice(i, i + batchSize);
      chunks.push(`INSERT INTO "FiscalCatalogCode" (
  "id", "type", "code", "description", "active", "validFrom", "validTo", "metadata", "sourceVersion", "createdAt", "updatedAt"
) VALUES
${slice.join(",\n")}
ON CONFLICT ("type", "code") DO UPDATE SET
  "description" = EXCLUDED."description",
  "active" = EXCLUDED."active",
  "validFrom" = EXCLUDED."validFrom",
  "validTo" = EXCLUDED."validTo",
  "metadata" = EXCLUDED."metadata",
  "sourceVersion" = EXCLUDED."sourceVersion",
  "updatedAt" = CURRENT_TIMESTAMP;
`);
    }
    total += values.length;
  }

  await mkdir(MIGRATION_DIR, { recursive: true });
  await writeFile(path.join(MIGRATION_DIR, "migration.sql"), chunks.join("\n"), "utf8");
  console.log(`Wrote ${total} codes to ${MIGRATION_DIR}/migration.sql`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
