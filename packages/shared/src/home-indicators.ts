/** Indicadores configuráveis do painel (home), com teto por plano. */

import {
  getPlanDefinition,
  listPlans,
  type PlanDefinition,
} from "./plans.js";

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

/** Teto do plano mais econômico (Start). Use `homeIndicatorLimitForPlan` para o plano atual. */
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

export const HOME_INDICATOR_DESCRIPTIONS: Record<HomeIndicatorKey, string> = {
  customer_positivacao:
    "Quantidade de clientes com pelo menos um pedido confirmado no período.",
  sales_by_supplier:
    "Ranking dos fornecedores com maior volume de vendas confirmadas no período.",
  sales_by_seller:
    "Ranking dos vendedores com maior volume de vendas confirmadas no período.",
  profit_by_city:
    "Cidades em que a operação obteve maior margem (receita menos custo do produto).",
  profit_by_product:
    "Produtos com maior rentabilidade no período, com base no custo cadastrado.",
  profit_by_customer:
    "Clientes que geraram maior margem no período, com base no custo cadastrado.",
};

export const HOME_INDICATOR_DATA_INFO: Record<HomeIndicatorKey, string> = {
  customer_positivacao:
    "Conta clientes distintos com pedido confirmado no período. Não considera valor nem margem.",
  sales_by_supplier:
    "Soma o valor dos pedidos confirmados agrupados pelo fornecedor do produto. Itens sem fornecedor não entram no ranking.",
  sales_by_seller:
    "Soma o valor dos pedidos confirmados agrupados pelo vendedor responsável pela venda.",
  profit_by_city:
    "Margem = receita − custo do produto cadastrado, agrupada pela cidade do cliente. Linhas sem custo entram com custo zero e são sinalizadas.",
  profit_by_product:
    "Margem = receita − custo do produto cadastrado, por produto. Linhas sem custo entram com custo zero e são sinalizadas.",
  profit_by_customer:
    "Margem = receita − custo do produto cadastrado, por cliente. Linhas sem custo entram com custo zero e são sinalizadas.",
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

/** `null` = ilimitado (plano completo). */
export function homeIndicatorLimitForPlan(
  planId: string | null | undefined,
): number | null {
  return getPlanDefinition(planId).limits.maxHomeIndicators;
}

export function formatHomeIndicatorLimit(limit: number | null): string {
  if (limit == null) return "todos os indicadores disponíveis";
  return `até ${limit} ${limit === 1 ? "indicador" : "indicadores"}`;
}

export function homeIndicatorLimitExceededMessage(limit: number): string {
  return `Seu plano permite no máximo ${limit} indicadores simultâneos. Faça upgrade para utilizar mais.`;
}

/** Menor plano cujo teto é maior que o atual — para CTA de upgrade. */
export function cheapestPlanWithHigherHomeIndicatorLimit(
  currentLimit: number | null,
): PlanDefinition | null {
  if (currentLimit == null) return null;
  return (
    listPlans().find((plan) => {
      const next = plan.limits.maxHomeIndicators;
      return next == null || next > currentLimit;
    }) ?? null
  );
}

/** Deduplica e valida; não aplica teto do plano. */
export function parseHomeIndicators(raw: unknown): HomeIndicatorKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_HOME_INDICATORS];
  const seen = new Set<HomeIndicatorKey>();
  const out: HomeIndicatorKey[] = [];
  for (const item of raw) {
    if (!isHomeIndicatorKey(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out.length > 0 ? out : [...DEFAULT_HOME_INDICATORS];
}

export function capHomeIndicators(
  keys: HomeIndicatorKey[],
  limit: number | null,
): HomeIndicatorKey[] {
  if (limit == null) return keys;
  return keys.slice(0, Math.max(0, limit));
}

export function defaultHomeIndicatorsForPlan(
  planId: string | null | undefined,
): HomeIndicatorKey[] {
  return capHomeIndicators(
    DEFAULT_HOME_INDICATORS,
    homeIndicatorLimitForPlan(planId),
  );
}

/**
 * Normaliza lista persistida: dedupe, ordem estável; aplica `limit` se informado.
 * `limit` null = sem teto. Sem `limit`, não corta (use `capHomeIndicators` com o plano).
 */
export function normalizeHomeIndicators(
  raw: unknown,
  limit?: number | null,
): HomeIndicatorKey[] {
  const parsed = parseHomeIndicators(raw);
  return limit === undefined ? parsed : capHomeIndicators(parsed, limit);
}

/**
 * Permite persistir acima do teto só para reordenar/remover após downgrade.
 * Nunca permite adicionar além do limite.
 */
export function persistHomeIndicatorsError(params: {
  next: HomeIndicatorKey[];
  current: HomeIndicatorKey[];
  limit: number | null;
}): string | null {
  const { next, current, limit } = params;
  if (next.length === 0) {
    return "Selecione pelo menos 1 indicador.";
  }
  if (limit == null || next.length <= limit) return null;
  if (next.length > current.length) {
    return homeIndicatorLimitExceededMessage(limit);
  }
  const currentSet = new Set(current);
  for (const key of next) {
    if (!currentSet.has(key)) {
      return homeIndicatorLimitExceededMessage(limit);
    }
  }
  return null;
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
