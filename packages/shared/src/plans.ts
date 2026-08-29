/**
 * Catálogo de planos SaaS (fonte da verdade).
 * Para mudar o que entra/sai de cada plano, edite só `PLAN_CATALOG` abaixo.
 */

export type PlanId = "start" | "pro" | "business";

export type PlanFeature =
  | "core_ops"
  | "sellers_basic"
  | "commissions"
  | "accounts_payable"
  | "reports_basic"
  | "whitelabel"
  | "price_tables"
  | "broadcast"
  | "fiscal_nfe"
  | "expedition"
  | "insights"
  | "teams"
  | "tracking"
  | "visits"
  | "reports_advanced"
  | "audit"
  | "reports_ai"
  | "multi_cnpj";

export type PlanLimits = {
  /** null = ilimitado (cobrado por assento) */
  maxSellers: number | null;
  /** Acessos administrativos (ADMIN + MANAGER) inclusos na mensalidade base */
  includedAdmins: number;
  /** Indicadores simultâneos no painel. null = todos os disponíveis */
  maxHomeIndicators: number | null;
};

export const SELLER_SEAT_PRICE_BRL = 29.9;
export const EXTRA_ADMIN_SEAT_PRICE_BRL = 29.9;

export type PlanDefinition = {
  id: PlanId;
  /** Nome comercial (UI) */
  name: string;
  /** Slug curto para badges */
  shortName: string;
  description: string;
  /** Mensalidade base (sem vendedores nem admins extras) */
  monthlyPriceBrl: number;
  sellerSeatPriceBrl: number;
  extraAdminSeatPriceBrl: number;
  features: PlanFeature[];
  limits: PlanLimits;
  /** Bullets comerciais (landing / checkout) */
  marketingFeatures: string[];
  marketingNote?: string;
  /** Destaque na landing */
  highlighted?: boolean;
};

export const PLAN_IDS: PlanId[] = ["start", "pro", "business"];

export const PLAN_FEATURE_LABELS: Record<PlanFeature, string> = {
  core_ops: "Operação (produtos, clientes, pedidos, estoque)",
  sellers_basic: "Vendedores",
  commissions: "Comissões e metas",
  accounts_payable: "Contas a pagar",
  reports_basic: "Relatórios básicos",
  whitelabel: "Logo personalizada",
  price_tables: "Tabelas de preço",
  broadcast: "Notificar vendedores",
  fiscal_nfe: "Fiscal / NF-e",
  expedition: "Expedição, bipagem e etiquetas",
  insights: "Insights e indicadores",
  teams: "Equipes",
  tracking: "Localização dos vendedores em tempo real",
  visits: "Acompanhamento da equipe externa",
  reports_advanced: "Relatórios avançados",
  audit: "Auditoria",
  reports_ai: "Análise de IA nos relatórios",
  multi_cnpj: "Múltiplos CNPJ (filiais) com o mesmo estoque",
};

const START_FEATURES: PlanFeature[] = [
  "core_ops",
  "sellers_basic",
  "commissions",
  "accounts_payable",
  "reports_basic",
  "whitelabel",
];

const PRO_FEATURES: PlanFeature[] = [
  ...START_FEATURES,
  "price_tables",
  "broadcast",
  "fiscal_nfe",
  "expedition",
  "insights",
];

const BUSINESS_FEATURES: PlanFeature[] = [
  ...PRO_FEATURES,
  "teams",
  "tracking",
  "visits",
  "reports_advanced",
  "audit",
  "reports_ai",
  "multi_cnpj",
];

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  start: {
    id: "start",
    name: "Start",
    shortName: "Start",
    description:
      "Ideal para pequenas distribuidoras que precisam organizar sua força de vendas e operação.",
    monthlyPriceBrl: 79.9,
    sellerSeatPriceBrl: SELLER_SEAT_PRICE_BRL,
    extraAdminSeatPriceBrl: EXTRA_ADMIN_SEAT_PRICE_BRL,
    features: START_FEATURES,
    limits: { maxSellers: null, includedAdmins: 1, maxHomeIndicators: 3 },
    marketingFeatures: [
      "App de força de vendas",
      "Funcionamento offline",
      "Emissão e compartilhamento de pedidos",
      "Cadastro ilimitado de produtos",
      "Cadastro ilimitado de clientes",
      "Controle de estoque",
      "Controle de comissão",
      "Controle de contas a pagar",
      "Relatórios básicos",
      "Logo personalizada",
      "Até 3 indicadores no painel",
      "1 acesso administrativo",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    shortName: "Pro",
    description:
      "Para empresas que precisam de uma operação comercial mais completa.",
    monthlyPriceBrl: 149.9,
    sellerSeatPriceBrl: SELLER_SEAT_PRICE_BRL,
    extraAdminSeatPriceBrl: EXTRA_ADMIN_SEAT_PRICE_BRL,
    features: PRO_FEATURES,
    limits: { maxSellers: null, includedAdmins: 2, maxHomeIndicators: 6 },
    highlighted: true,
    marketingFeatures: [
      "Tudo do plano Start",
      "2 acessos administrativos",
      "Emissão de NF-e",
      "Módulo de expedição",
      "Suporte para bipadora de código de barras",
      "Conferência de pedidos por bipagem",
      "Geração de etiquetas",
      "Impressão de etiquetas",
      "Fluxo integrado de pedido → NF-e → expedição",
      "Insights",
      "Análise e acompanhamento de indicadores da operação",
      "Até 6 indicadores no painel",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    shortName: "Business",
    description:
      "Para distribuidoras que precisam de controle avançado, inteligência e gestão da equipe.",
    monthlyPriceBrl: 299,
    sellerSeatPriceBrl: SELLER_SEAT_PRICE_BRL,
    extraAdminSeatPriceBrl: EXTRA_ADMIN_SEAT_PRICE_BRL,
    features: BUSINESS_FEATURES,
    limits: { maxSellers: null, includedAdmins: 6, maxHomeIndicators: null },
    marketingFeatures: [
      "Tudo do plano Pro",
      "6 acessos administrativos",
      "Operação completa",
      "Gestão comercial avançada",
      "Gestão fiscal",
      "Gestão de estoque",
      "Gestão financeira",
      "Relatórios avançados",
      "Análise de IA nos relatórios",
      "Insights avançados",
      "Indicadores ilimitados no painel",
      "Localização dos vendedores em tempo real",
      "Acompanhamento da equipe externa",
      "Funções personalizadas sob demanda",
      "Integrações e adaptações específicas",
      "Múltiplos CNPJ (filiais) usando o mesmo estoque",
    ],
    marketingNote:
      "Funções personalizadas sob demanda podem ser cobradas separadamente, de acordo com a complexidade do desenvolvimento. Acessos administrativos adicionais têm o custo de R$ 29,90/mês.",
  },
};

export const DEFAULT_PLAN_ID: PlanId = "start";

/**
 * Trial padrão ao cadastrar uma organização (dias).
 * Cada empresa nova ganha este período; convites na mesma org não renovam.
 */
export const DEFAULT_TRIAL_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Dias restantes de trial a partir de `currentPeriodEnd`.
 * Usa o instante UTC (timestamptz); na UI formatar em America/Sao_Paulo.
 * `null` se não houver data; `0` se já expirou.
 */
export function trialDaysRemaining(
  currentPeriodEnd: string | Date | null | undefined,
  now = new Date(),
): number | null {
  if (!currentPeriodEnd) return null;
  const end =
    typeof currentPeriodEnd === "string"
      ? new Date(currentPeriodEnd)
      : currentPeriodEnd;
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / MS_PER_DAY);
}

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

export function roundMoneyBrl(value: number): number {
  return Math.round(value * 100) / 100;
}

export function extraAdminCount(
  adminCount: number,
  includedAdmins: number,
): number {
  return Math.max(0, adminCount - includedAdmins);
}

/** Total mensal = base + vendedores × 29,90 + admins extras × 29,90. */
export function planMonthlyTotal(
  planId: string | null | undefined,
  sellerCount: number,
  adminCount: number,
): number {
  const def = getPlanDefinition(planId);
  const extra = extraAdminCount(adminCount, def.limits.includedAdmins);
  return roundMoneyBrl(
    def.monthlyPriceBrl +
      Math.max(0, sellerCount) * def.sellerSeatPriceBrl +
      extra * def.extraAdminSeatPriceBrl,
  );
}

export function formatPlanPriceBrl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function planSeatPriceCaption(plan: PlanDefinition): string {
  return `${formatPlanPriceBrl(plan.monthlyPriceBrl)}/mês + ${formatPlanPriceBrl(plan.sellerSeatPriceBrl)} por vendedor`;
}
