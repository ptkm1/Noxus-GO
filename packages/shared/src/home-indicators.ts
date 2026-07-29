/** Indicadores configuráveis do painel (home) — máx. 3 por organização. */

export const HOME_INDICATOR_KEYS = [
  "sales_by_supplier",
  "sales_by_seller",
  "profit_by_city",
  "profit_by_product",
  "profit_by_customer",
] as const;

export type HomeIndicatorKey = (typeof HOME_INDICATOR_KEYS)[number];

export const MAX_HOME_INDICATORS = 3;

/** Default: mantém o Top fornecedores existente e completa com 2 indicadores úteis. */
export const DEFAULT_HOME_INDICATORS: HomeIndicatorKey[] = [
  "sales_by_supplier",
  "sales_by_seller",
  "profit_by_product",
];

export const HOME_INDICATOR_LABELS: Record<HomeIndicatorKey, string> = {
  sales_by_supplier: "Total de vendas por fornecedor",
  sales_by_seller: "Total de vendas por vendedor",
  profit_by_city: "Cidades com maiores rentabilidades",
  profit_by_product: "Top produtos com maior rentabilidade",
  profit_by_customer: "Top clientes com maior rentabilidade",
};

export const HOME_INDICATOR_SHORT_LABELS: Record<HomeIndicatorKey, string> = {
  sales_by_supplier: "Top fornecedores",
  sales_by_seller: "Top vendedores",
  profit_by_city: "Rentabilidade por cidade",
  profit_by_product: "Top produtos com maior rentabilidade",
  profit_by_customer: "Top clientes com maior rentabilidade",
};

export function isHomeIndicatorKey(value: unknown): value is HomeIndicatorKey {
  return (
    typeof value === "string" &&
    (HOME_INDICATOR_KEYS as readonly string[]).includes(value)
  );
}

/** Normaliza lista persistida: dedupe, ordem estável, máx. 3; fallback para default. */
export function normalizeHomeIndicators(
  raw: unknown,
): HomeIndicatorKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_HOME_INDICATORS];
  const seen = new Set<HomeIndicatorKey>();
  const out: HomeIndicatorKey[] = [];
  for (const item of raw) {
    if (!isHomeIndicatorKey(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= MAX_HOME_INDICATORS) break;
  }
  return out.length > 0 ? out : [...DEFAULT_HOME_INDICATORS];
}
