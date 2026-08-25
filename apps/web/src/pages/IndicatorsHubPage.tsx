import { useAuth } from "@/auth/AuthContext";
import { canRead, planHasFeature, type PlanFeature } from "@pedidos/shared";
import {
  BarChart3,
  Lightbulb,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

type HubCard = {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  planFeature?: PlanFeature;
  /** Sem página ainda — card visível desabilitado. */
  comingSoon?: boolean;
};

const CARDS: HubCard[] = [
  {
    to: "/relatorios",
    title: "Relatórios",
    description:
      "PDFs e relatórios por categoria: vendas, clientes, produtos, faturamento e comissões.",
    icon: BarChart3,
  },
  {
    to: "/insights",
    title: "Insights",
    description:
      "Painel analítico do dia a dia: totais, ranking, carteira e giro.",
    icon: Lightbulb,
    planFeature: "insights",
  },
  {
    to: "/indicadores/ia",
    title: "Indicadores IA",
    description:
      "Análise assistida por IA sobre vendas, estoque e operação.",
    icon: Sparkles,
    /** Página ainda não existe — card preparado; feature `reports_ai` quando for liberado. */
    comingSoon: true,
  },
];

function userHasPlanFeature(
  user: ReturnType<typeof useAuth>["user"],
  feature: PlanFeature | undefined,
): boolean {
  if (!feature) return true;
  const planId = user?.subscription?.planId;
  if (user?.subscription?.features?.length) {
    return user.subscription.features.includes(feature);
  }
  return planHasFeature(planId, feature);
}

export function IndicatorsHubPage() {
  const { user } = useAuth();
  const canReports = Boolean(
    user && canRead(user.role, "reports", user.permissions),
  );

  const cards = CARDS.filter((c) => {
    if (!canReports) return false;
    if (c.comingSoon) return true;
    return userHasPlanFeature(user, c.planFeature);
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Início
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">Indicadores</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">Indicadores</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Relatórios, insights e análises da operação em um só lugar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const content = (
            <>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {c.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.description}
                </p>
                {c.comingSoon ? (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    Em breve
                  </p>
                ) : null}
              </div>
            </>
          );

          if (c.comingSoon) {
            return (
              <div
                key={c.to}
                aria-disabled="true"
                className="surface-card flex cursor-not-allowed gap-4 p-5 opacity-50"
              >
                {content}
              </div>
            );
          }

          return (
            <Link
              key={c.to}
              to={c.to}
              className="group surface-card flex gap-4 p-5 transition hover:border-primary/40 hover:shadow-md"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
