import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatFiscalCodeLabel,
  inferCfopContexts,
  isCodeCurrentlyValid,
  isFiscalCatalogType,
  normalizeCestCode,
  normalizeCfopCode,
  normalizeNcmCode,
  type FiscalCatalogCodeDto,
  type FiscalCatalogSearchResult,
  type FiscalCatalogType,
} from "@pedidos/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Diretório padrão dos JSONs oficiais (versionados no repo). */
export function defaultFiscalCatalogDataDir(): string {
  const candidates = [
    path.resolve(__dirname, "../../../data/fiscal-catalog"),
    path.resolve(process.cwd(), "apps/api/data/fiscal-catalog"),
    path.resolve(process.cwd(), "data/fiscal-catalog"),
  ];
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0];
}

export type FiscalCatalogImportEntry = {
  code: string;
  description: string;
  active?: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  metadata?: Record<string, unknown>;
};

export type FiscalCatalogFile = {
  type: string;
  sourceVersion: string;
  entries: FiscalCatalogImportEntry[];
};

function normalizeCodeForType(type: FiscalCatalogType, raw: string): string {
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

function toDto(row: {
  id: string;
  type: string;
  code: string;
  description: string;
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  metadata: unknown;
  sourceVersion: string | null;
}): FiscalCatalogCodeDto {
  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const outdated = !isCodeCurrentlyValid({
    active: row.active,
    validFrom: row.validFrom,
    validTo: row.validTo,
  });
  return {
    id: row.id,
    type: row.type as FiscalCatalogType,
    code: row.code,
    description: row.description,
    active: row.active,
    validFrom: row.validFrom?.toISOString() ?? null,
    validTo: row.validTo?.toISOString() ?? null,
    metadata,
    sourceVersion: row.sourceVersion,
    outdated,
  };
}

export type SearchFiscalCatalogInput = {
  type: FiscalCatalogType;
  q?: string;
  limit?: number;
  offset?: number;
  /** Inclui inativos / fora de vigência (ex.: produto antigo). */
  includeInactive?: boolean;
  /** Filtro de contexto CFOP. */
  context?: string;
  /** Para CFOP: INBOUND (1–3) ou OUTBOUND (5–7). */
  direction?: "INBOUND" | "OUTBOUND";
  /** NCM relacionado (para sugerir CEST). */
  relatedNcm?: string;
  at?: Date;
};

export async function searchFiscalCatalog(
  input: SearchFiscalCatalogInput,
): Promise<FiscalCatalogSearchResult> {
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const q = (input.q ?? "").trim();
  const at = input.at ?? new Date();

  const where: Prisma.FiscalCatalogCodeWhereInput = {
    type: input.type,
  };
  const and: Prisma.FiscalCatalogCodeWhereInput[] = [];

  if (!input.includeInactive) {
    where.active = true;
    and.push(
      { OR: [{ validFrom: null }, { validFrom: { lte: at } }] },
      { OR: [{ validTo: null }, { validTo: { gte: at } }] },
    );
  }

  if (q) {
    const digits = q.replace(/\D/g, "");
    const textOr: Prisma.FiscalCatalogCodeWhereInput[] = [
      { description: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
    ];
    if (digits) {
      textOr.push({ code: { contains: digits } });
    }
    and.push({ OR: textOr });
  }

  if (input.context && input.type === "CFOP") {
    and.push({
      metadata: {
        path: ["contexts"],
        array_contains: [input.context],
      },
    });
  }

  if (input.direction && input.type === "CFOP") {
    const prefixes =
      input.direction === "OUTBOUND" ? ["5", "6", "7"] : ["1", "2", "3"];
    and.push({
      OR: prefixes.map((p) => ({ code: { startsWith: p } })),
    });
  }

  // relatedNcm é aceito na API para evolução (ordenar por vínculo NCM↔CEST).
  void input.relatedNcm;

  if (and.length) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), ...and];
  }

  const [total, rows] = await Promise.all([
    prisma.fiscalCatalogCode.count({ where }),
    prisma.fiscalCatalogCode.findMany({
      where,
      orderBy: [{ code: "asc" }],
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    items: rows.map(toDto),
    total,
    limit,
    offset,
  };
}

export async function resolveFiscalCatalogCode(input: {
  type: FiscalCatalogType;
  code: string;
  includeInactive?: boolean;
}): Promise<FiscalCatalogCodeDto | null> {
  const code = normalizeCodeForType(input.type, input.code);
  if (!code) return null;
  const row = await prisma.fiscalCatalogCode.findUnique({
    where: { type_code: { type: input.type, code } },
  });
  if (!row) return null;
  const dto = toDto(row);
  if (!input.includeInactive && dto.outdated) return null;
  return dto;
}

export async function countFiscalCatalogByType(
  type: FiscalCatalogType,
): Promise<number> {
  return prisma.fiscalCatalogCode.count({ where: { type, active: true } });
}

function parseBrDate(raw?: string | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const year = Number(m[3]);
  if (year >= 9999) return null;
  return `${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z`;
}

/**
 * Aceita o formato interno `{ type, sourceVersion, entries }`
 * ou a tabela oficial NCM `{ Nomenclaturas: [{ Codigo, Descricao, ... }] }`.
 */
export function parseFiscalCatalogJson(raw: unknown): FiscalCatalogFile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.Nomenclaturas)) {
    const rows = obj.Nomenclaturas as Array<Record<string, unknown>>;
    const entries: FiscalCatalogImportEntry[] = [];
    for (const r of rows) {
      const code = normalizeNcmCode(String(r.Codigo ?? ""));
      if (code.length !== 8) continue;
      const description = String(r.Descricao ?? "").trim();
      if (!description) continue;
      const validFrom = parseBrDate(
        typeof r.Data_Inicio === "string" ? r.Data_Inicio : null,
      );
      const validTo = parseBrDate(
        typeof r.Data_Fim === "string" ? r.Data_Fim : null,
      );
      const active = !validTo || new Date(validTo).getTime() >= Date.now();
      entries.push({
        code,
        description,
        active,
        validFrom,
        validTo,
      });
    }
    const source =
      [obj.Data_Ultima_Atualizacao_NCM, obj.Ato]
        .filter((v) => typeof v === "string" && v.trim())
        .join(" · ") || "NCM-oficial";
    return { type: "NCM", sourceVersion: source, entries };
  }

  if (typeof obj.type === "string" && Array.isArray(obj.entries)) {
    return obj as FiscalCatalogFile;
  }
  return null;
}

function toCreateRow(
  type: FiscalCatalogType,
  entry: FiscalCatalogImportEntry,
  sourceVersion: string,
) {
  const code = normalizeCodeForType(type, entry.code);
  const description = entry.description.trim();
  if (!code || !description) return null;
  if (type === "NCM" && code.length !== 8) return null;

  const metaObj: Record<string, Prisma.InputJsonValue> = {};
  if (entry.metadata) {
    for (const [k, v] of Object.entries(entry.metadata)) {
      metaObj[k] = v as Prisma.InputJsonValue;
    }
  }
  if (type === "CFOP" && !Array.isArray(metaObj.contexts)) {
    metaObj.contexts = inferCfopContexts(code, description);
  }

  return {
    id: randomUUID(),
    type,
    code,
    description,
    active: entry.active !== false,
    validFrom: entry.validFrom ? new Date(entry.validFrom) : null,
    validTo: entry.validTo ? new Date(entry.validTo) : null,
    metadata: metaObj as Prisma.InputJsonValue,
    sourceVersion,
  };
}

/**
 * Upsert em lote a partir de um arquivo JSON oficial.
 * Não inventa códigos — apenas persiste o que vier na fonte.
 */
export async function importFiscalCatalogFile(
  file: FiscalCatalogFile,
): Promise<{ type: FiscalCatalogType; upserted: number }> {
  if (!isFiscalCatalogType(file.type)) {
    throw new Error(`Tipo de catálogo fiscal inválido: ${file.type}`);
  }
  const type = file.type;
  const rows = file.entries
    .map((entry) => toCreateRow(type, entry, file.sourceVersion))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (
    rows.length > 50 &&
    (type === "NCM" || type === "CFOP" || type === "CEST")
  ) {
    await prisma.fiscalCatalogCode.deleteMany({ where: { type } });
    const chunk = 1000;
    for (let i = 0; i < rows.length; i += chunk) {
      await prisma.fiscalCatalogCode.createMany({
        data: rows.slice(i, i + chunk),
      });
    }
    return { type, upserted: rows.length };
  }

  let upserted = 0;
  for (const row of rows) {
    await prisma.fiscalCatalogCode.upsert({
      where: { type_code: { type, code: row.code } },
      create: row,
      update: {
        description: row.description,
        active: row.active,
        validFrom: row.validFrom,
        validTo: row.validTo,
        metadata: row.metadata,
        sourceVersion: row.sourceVersion,
        updatedAt: new Date(),
      },
    });
    upserted += 1;
  }

  return { type, upserted };
}

export async function importFiscalCatalogFromDir(
  dir = defaultFiscalCatalogDataDir(),
): Promise<{ files: number; upserted: number }> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return { files: 0, upserted: 0 };
  }

  let upserted = 0;
  let files = 0;
  for (const name of names) {
    const raw = await readFile(path.join(dir, name), "utf8");
    const parsed = parseFiscalCatalogJson(JSON.parse(raw));
    if (!parsed) continue;
    const result = await importFiscalCatalogFile(parsed);
    upserted += result.upserted;
    files += 1;
  }
  return { files, upserted };
}

/**
 * Produção não roda seed. Se NCM ainda não foi carregado, importa os JSONs oficiais.
 */
export async function ensureFiscalCatalogImported(): Promise<{
  skipped: boolean;
  files: number;
  upserted: number;
  count: number;
}> {
  const count = await prisma.fiscalCatalogCode.count({
    where: { type: "NCM" },
  });
  if (count > 0) {
    return { skipped: true, files: 0, upserted: 0, count };
  }
  const result = await importFiscalCatalogFromDir();
  const after = await prisma.fiscalCatalogCode.count();
  return { skipped: false, ...result, count: after };
}

/** Hash estável do conteúdo de um arquivo (para testes / auditoria). */
export function hashFiscalCatalogPayload(payload: string): string {
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export { formatFiscalCodeLabel };
