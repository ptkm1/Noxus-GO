/**
 * Tipos e utilitários do catálogo fiscal nacional.
 * Códigos oficiais vivem no banco (FiscalCatalogCode), não na UI.
 */

export const FISCAL_CATALOG_TYPES = [
  "NCM",
  "CEST",
  "CFOP",
  "CST_ICMS",
  "CSOSN",
  "ORIGEM",
  "CST_PIS",
  "CBS",
  "IBS",
  "CLASS_TRIB",
  "BENEFICIO",
] as const;

export type FiscalCatalogType = (typeof FISCAL_CATALOG_TYPES)[number];

export function isFiscalCatalogType(v: string): v is FiscalCatalogType {
  return (FISCAL_CATALOG_TYPES as readonly string[]).includes(v);
}

/** Contextos de operação para filtrar CFOP. */
export const CFOP_CONTEXTS = [
  "VENDA_INTERNA",
  "VENDA_INTERESTADUAL",
  "ENTRADA_INTERNA",
  "ENTRADA_INTERESTADUAL",
  "DEVOLUCAO",
  "BONIFICACAO",
  "TRANSFERENCIA",
] as const;

export type CfopContext = (typeof CFOP_CONTEXTS)[number];

export type FiscalCatalogCodeDto = {
  id: string;
  type: FiscalCatalogType;
  code: string;
  description: string;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  metadata: Record<string, unknown>;
  sourceVersion: string | null;
  /** true quando o código existe mas está fora da vigência / inativo */
  outdated?: boolean;
};

export type FiscalCatalogSearchResult = {
  items: FiscalCatalogCodeDto[];
  total: number;
  limit: number;
  offset: number;
};

/** Formata "código — descrição" para exibição. */
export function formatFiscalCodeLabel(
  code: string,
  description?: string | null,
): string {
  const c = code.trim();
  const d = (description ?? "").trim();
  if (!c) return d;
  if (!d) return c;
  return `${c} — ${d}`;
}

/** Normaliza NCM para 8 dígitos. */
export function normalizeNcmCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

/** Normaliza CEST para 7 dígitos. */
export function normalizeCestCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 7);
}

/** Normaliza CFOP para 4 dígitos (aceita 5.102 → 5102). */
export function normalizeCfopCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

/** Exibe CFOP com ponto (5102 → 5.102). */
export function formatCfopDisplay(code: string): string {
  const d = normalizeCfopCode(code);
  if (d.length !== 4) return code.trim();
  return `${d[0]}.${d.slice(1)}`;
}

/** Exibe NCM com máscara (22060090 → 2206.00.90). */
export function formatNcmDisplay(code: string): string {
  const d = normalizeNcmCode(code);
  if (d.length !== 8) return code.trim();
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}

/**
 * Infere contextos CFOP a partir do primeiro dígito e descrição.
 * Não inventa regras fiscais — apenas filtros de UX baseados na tabela oficial.
 */
export function inferCfopContexts(
  code: string,
  description: string,
): CfopContext[] {
  const d = normalizeCfopCode(code);
  const desc = description.toLowerCase();
  const contexts: CfopContext[] = [];
  const first = d[0];

  if (first === "5") contexts.push("VENDA_INTERNA");
  if (first === "6") contexts.push("VENDA_INTERESTADUAL");
  if (first === "1") contexts.push("ENTRADA_INTERNA");
  if (first === "2") contexts.push("ENTRADA_INTERESTADUAL");

  if (desc.includes("devolu")) contexts.push("DEVOLUCAO");
  if (desc.includes("bonifica") || desc.includes("brinde")) {
    contexts.push("BONIFICACAO");
  }
  if (desc.includes("transfer")) contexts.push("TRANSFERENCIA");

  return contexts;
}

export function isCodeCurrentlyValid(input: {
  active: boolean;
  validFrom?: Date | string | null;
  validTo?: Date | string | null;
  at?: Date;
}): boolean {
  if (!input.active) return false;
  const at = input.at ?? new Date();
  const from = input.validFrom ? new Date(input.validFrom) : null;
  const to = input.validTo ? new Date(input.validTo) : null;
  if (from && from.getTime() > at.getTime()) return false;
  if (to && to.getTime() < at.getTime()) return false;
  return true;
}
