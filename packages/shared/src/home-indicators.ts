/** Indicadores configuráveis do painel (home) — máx. 3 por organização. */

export const HOME_INDICATOR_KEYS = [
  "customer_positivacao",
  "sales_by_supplier",
  "sales_by_seller",
  "profit_by_city",
  "profit_by_product",
  "profit_by_customer",
] as const;

export type HomeIndicatorKey = (typeof HOME_INDICATOR_KEYS)[number];

/** Widgets de ranking (barra) — exclui positivação (widget próprio). */
export type HomeChartIndicatorKey = Exclude<
  HomeIndicatorKey,
  "customer_positivacao"
>;

export const HOME_CHART_INDICATOR_KEYS = HOME_INDICATOR_KEYS.filter(
  (k): k is HomeChartIndicatorKey => k !== "customer_positivacao",
);

export const MAX_HOME_INDICATORS = 3;

/** Default alinhado à coluna direita da home (widgets). */
export const DEFAULT_HOME_INDICATORS: HomeIndicatorKey[] = [
  "customer_positivacao",
  "sales_by_seller",
  "profit_by_product",
];

export const HOME_INDICATOR_LABELS: Record<HomeIndicatorKey, string> = {
  customer_positivacao: "Clientes positivados",
  sales_by_supplier: "Total de vendas por fornecedor",
  sales_by_seller: "Total de vendas por vendedor",
  profit_by_city: "Cidades com maiores rentabilidades",
  profit_by_product: "Top produtos com maior rentabilidade",
  profit_by_customer: "Top clientes com maior rentabilidade",
};

export const HOME_INDICATOR_SHORT_LABELS: Record<HomeIndicatorKey, string> = {
  customer_positivacao: "Positivação",
  sales_by_supplier: "Top fornecedores",
  sales_by_seller: "Top vendedores",
  profit_by_city: "Rentabilidade por cidade",
  profit_by_product: "Top produtos",
  profit_by_customer: "Top clientes",
};

export function isHomeIndicatorKey(value: unknown): value is HomeIndicatorKey {
  return (
    typeof value === "string" &&
    (HOME_INDICATOR_KEYS as readonly string[]).includes(value)
  );
}

export function isHomeChartIndicatorKey(
  value: unknown,
): value is HomeChartIndicatorKey {
  return isHomeIndicatorKey(value) && value !== "customer_positivacao";
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

/**
 * Layout grade/stack legado (`Organization.homeIndicatorsLayout`).
 * A home atual usa só a coluna de widgets — estes helpers existem para leitura/seed.
 */
export const HOME_INDICATORS_LAYOUTS = ["grid", "stack"] as const;

export type HomeIndicatorsLayout = (typeof HOME_INDICATORS_LAYOUTS)[number];

export const DEFAULT_HOME_INDICATORS_LAYOUT: HomeIndicatorsLayout = "grid";

export const HOME_INDICATORS_LAYOUT_LABELS: Record<
  HomeIndicatorsLayout,
  string
> = {
  stack: "Empilhado (um abaixo do outro)",
  grid: "Grade (lado a lado)",
};

export function isHomeIndicatorsLayout(
  value: unknown,
): value is HomeIndicatorsLayout {
  return (
    typeof value === "string" &&
    (HOME_INDICATORS_LAYOUTS as readonly string[]).includes(value)
  );
}

export function normalizeHomeIndicatorsLayout(
  raw: unknown,
): HomeIndicatorsLayout {
  return isHomeIndicatorsLayout(raw) ? raw : DEFAULT_HOME_INDICATORS_LAYOUT;
}
