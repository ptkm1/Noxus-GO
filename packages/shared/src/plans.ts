/**
 * Catálogo de planos SaaS (fonte da verdade).
 * Para mudar o que entra/sai de cada plano, edite só `PLAN_CATALOG` abaixo.
 */

export type PlanId = "starter" | "growth" | "pro";

export type PlanFeature =
  | "core_ops"
  | "sellers_basic"
  | "teams"
  | "commissions"
  | "price_tables"
  | "tracking"
  | "visits"
  | "insights"
  | "reports_advanced"
  | "fiscal_nfe"
  | "broadcast"
  | "audit"
  | "whitelabel";

export type PlanLimits = {
  /** null = ilimitado */
  maxSellers: number | null;
  /** null = ilimitado */
  maxUsers: number | null;
};

export type PlanDefinition = {
  id: PlanId;
  /** Nome comercial (UI) */
  name: string;
  /** Slug curto para badges */
  shortName: string;
  description: string;
  monthlyPriceBrl: number;
  features: PlanFeature[];
  limits: PlanLimits;
  /** Destaque na landing */
  highlighted?: boolean;
};

export const PLAN_IDS: PlanId[] = ["starter", "growth", "pro"];

export const PLAN_FEATURE_LABELS: Record<PlanFeature, string> = {
  core_ops: "Operação (produtos, clientes, pedidos, estoque)",
  sellers_basic: "Vendedores",
  teams: "Equipes",
  commissions: "Comissões e metas",
  price_tables: "Tabelas de preço",
  tracking: "Rastreio de vendedores",
  visits: "Visitas / check-in",
  insights: "Insights do dia",
  reports_advanced: "Relatórios avançados",
  fiscal_nfe: "Fiscal / NF-e",
  broadcast: "Notificar vendedores",
  audit: "Auditoria",
  whitelabel: "Whitelabel (logo / marca)",
};

const STARTER_FEATURES: PlanFeature[] = ["core_ops", "sellers_basic"];

const GROWTH_FEATURES: PlanFeature[] = [
  ...STARTER_FEATURES,
  "teams",
  "commissions",
  "price_tables",
  "tracking",
  "visits",
  "insights",
  "reports_advanced",
];

const PRO_FEATURES: PlanFeature[] = [
  ...GROWTH_FEATURES,
  "fiscal_nfe",
  "broadcast",
  "audit",
  "whitelabel",
];

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Comum",
    shortName: "Comum",
    description: "Para começar a vender e organizar o básico.",
    monthlyPriceBrl: 149,
    features: STARTER_FEATURES,
    limits: { maxSellers: 3, maxUsers: 5 },
  },
  growth: {
    id: "growth",
    name: "Intermediário",
    shortName: "Intermediário",
    description: "Gestão de equipe, metas, rota e relatórios.",
    monthlyPriceBrl: 349,
    features: GROWTH_FEATURES,
    limits: { maxSellers: 15, maxUsers: 25 },
    highlighted: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    shortName: "Pro",
    description: "Tudo liberado, incluindo fiscal NF-e e whitelabel.",
    monthlyPriceBrl: 699,
    features: PRO_FEATURES,
    limits: { maxSellers: null, maxUsers: null },
  },
};

export const DEFAULT_PLAN_ID: PlanId = "starter";

/** Trial padrão ao cadastrar org (dias). */
export const DEFAULT_TRIAL_DAYS = 14;

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as string[]).includes(value);
}

export function getPlanDefinition(
  planId: string | null | undefined,
): PlanDefinition {
  if (planId && isPlanId(planId)) return PLAN_CATALOG[planId];
  return PLAN_CATALOG[DEFAULT_PLAN_ID];
}

export function planHasFeature(
  planId: string | null | undefined,
  feature: PlanFeature,
): boolean {
  return getPlanDefinition(planId).features.includes(feature);
}

/** Menor plano (por preço) que inclui a feature — para CTAs de upgrade. */
export function cheapestPlanWithFeature(
  feature: PlanFeature,
): PlanDefinition | null {
  const ranked = PLAN_IDS.map((id) => PLAN_CATALOG[id]).sort(
    (a, b) => a.monthlyPriceBrl - b.monthlyPriceBrl,
  );
  return ranked.find((p) => p.features.includes(feature)) ?? null;
}

export function listPlans(): PlanDefinition[] {
  return PLAN_IDS.map((id) => PLAN_CATALOG[id]);
}

/** Resolve plano pelo valor mensal cobrado no Asaas (ex.: 349 → growth). */
export function planIdFromMonthlyPrice(value: number): PlanId | null {
  const normalized = Math.round(value * 100) / 100;
  const match = PLAN_IDS.find(
    (id) => PLAN_CATALOG[id].monthlyPriceBrl === normalized,
  );
  if (match) return match;
  // tolerância para arredondamento do gateway (ex.: 348.99)
  return (
    PLAN_IDS.find(
      (id) => Math.abs(PLAN_CATALOG[id].monthlyPriceBrl - normalized) < 0.02,
    ) ?? null
  );
}
