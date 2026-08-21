import { useAuth } from "@/auth/AuthContext";
import { HomeIndicatorWidget } from "@/components/HomeIndicatorWidget";
import { RecentSalesList } from "@/components/RecentSalesList";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { periodRange } from "@/lib/period-presets";
import { isWebAdmin, isWebTeamLeader } from "@/lib/staff";
import { cn } from "@/lib/utils";
import {
  normalizeHomeIndicators,
  normalizeHomeIndicatorsLayout,
  trialDaysRemaining,
  type HomeIndicatorKey,
  type HomeIndicatorsLayout,
} from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  FileText,
  LayoutDashboard,
  Loader2,
  MapPin,
  Navigation,
  Package,
  ShoppingCart,
  Table,
  Target,
  Truck,
  UserCircle,
  UserCog,
  Users,
  Warehouse,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

type DashCard = {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const adminCards: DashCard[] = [
  {
    to: "/tabelas-preco",
    title: "Tabelas de preço",
    description: "Tabelas e preços por produto",
    icon: Table,
  },
  {
    to: "/produtos",
    title: "Produtos",
    description: "Lista, edição e base de cadastro",
    icon: Package,
  },
  {
    to: "/fornecedores",
    title: "Fornecedores",
    description: "Cadastro com CNPJ e vínculo aos produtos",
    icon: Truck,
  },
  {
    to: "/vendedores",
    title: "Vendedores",
    description: "Comissão, gestor e produtos liberados",
    icon: Users,
  },
  {
    to: "/usuarios",
    title: "Usuários",
    description: "Administradores e gestores da empresa",
    icon: UserCog,
  },
  {
    to: "/equipes",
    title: "Equipes",
    description: "Equipes nomeadas com líder e membros",
    icon: UsersRound,
  },
  {
    to: "/comissao",
    title: "Comissões e metas",
    description: "Faixas progressivas ou metas mensais",
    icon: Target,
  },
  {
    to: "/clientes",
    title: "Clientes",
    description: "Cadastro e vínculo com vendedor",
    icon: UserCircle,
  },
  {
    to: "/rastreio",
    title: "Rastreio ao vivo",
    description: "Mapa com posição em tempo real",
    icon: Navigation,
  },
  {
    to: "/visitas",
    title: "Visitas em campo",
    description: "Check-ins com GPS e duração",
    icon: MapPin,
  },
  {
    to: "/pedidos",
    title: "Pedidos",
    description: "Lista e detalhes com itens e status",
    icon: ShoppingCart,
  },
  {
    to: "/faturamento",
    title: "Faturamento",
    description: "NF-e de saída e entrada",
    icon: FileText,
  },
  {
    to: "/estoque",
    title: "Estoque",
    description: "Saldos e lançamentos manuais",
    icon: Warehouse,
  },
  {
    to: "/relatorios",
    title: "Relatórios",
description: "Vendas, margem, estoque, fiscal, visitas e PDFs",
    icon: BarChart3,
  },
  {
    to: "/indicadores",
    title: "Indicadores",
    description: "Quem vendeu menos, carteira e giro",
    icon: Activity,
  },
];

const managerCards: DashCard[] = [
  {
    to: "/rastreio",
    title: "Rastreio ao vivo",
    description: "Acompanhe a sua equipe no mapa",
    icon: Navigation,
  },
  {
    to: "/visitas",
    title: "Visitas em campo",
    description: "Check-ins dos vendedores",
    icon: MapPin,
  },
  {
    to: "/pedidos",
    title: "Pedidos",
    description: "Pedidos da equipe (leitura)",
    icon: ShoppingCart,
  },
];

const teamLeaderCards: DashCard[] = [
  {
    to: "/rastreio",
    title: "Rastreio ao vivo",
    description: "Acompanhe sua equipe no mapa",
    icon: Navigation,
  },
  {
    to: "/visitas",
    title: "Visitas em campo",
    description: "Check-ins dos vendedores da equipe",
    icon: MapPin,
  },
  {
    to: "/pedidos",
    title: "Pedidos",
    description: "Pedidos confirmados da equipe",
    icon: ShoppingCart,
  },
  {
    to: "/insights",
    title: "Insights da equipe",
    description: "Totais, ranking e produtos vendidos",
    icon: BarChart3,
  },
];

export function DashboardHome() {
  const { user } = useAuth();
  const admin = isWebAdmin(user?.role);
  const teamLeader = isWebTeamLeader(user);
  const cards = admin
    ? adminCards
    : teamLeader
      ? teamLeaderCards
      : managerCards;

  const {
    data: teamSellers = [],
    isLoading: teamSellersLoading,
    isFetching: teamSellersFetching,
  } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<{ id: string }[]>("/admin/sellers"),
    enabled: teamLeader,
  });

  const { data: pendingCredit } = useQuery({
    queryKey: ["admin", "pending-credit-summary"],
    queryFn: () =>
      apiFetch<{ count: number }>("/admin/orders/pending-credit-summary"),
    staleTime: 15_000,
    refetchInterval: 20_000,
    enabled: admin,
    meta: { silentError: true },
  });

  const {
    data: recentOrders = [],
    isLoading: recentOrdersLoading,
    isFetching: recentOrdersFetching,
  } = useQuery({
    queryKey: ["admin", "orders", "recent"],
    queryFn: () =>
      apiFetch<
        {
          id: string;
          status: string;
          totalAmount: unknown;
          createdAt: string;
          seller: { user: { name: string } };
          customer: { name: string } | null;
          items: { id: string }[];
        }[]
      >("/admin/orders"),
    staleTime: 30_000,
  });

  const monthRange = periodRange("this_month");
  const { data: scorecard, isLoading: scorecardLoading } = useQuery({
    queryKey: ["admin", "reports", "scorecard", "dashboard", monthRange.from],
    queryFn: () =>
      apiFetch<{
        totals: { orderCount: number; totalAmount: number; avgTicket: number };
      }>(
        `/admin/reports/scorecard?from=${encodeURIComponent(monthRange.from)}&to=${encodeURIComponent(monthRange.to)}`,
      ),
    staleTime: 60_000,
  });

  const { data: homeConfig } = useQuery({
    queryKey: ["admin", "reports", "home-dashboard-config"],
    queryFn: () =>
      apiFetch<{
        homeIndicators: HomeIndicatorKey[];
        homeIndicatorsLayout: HomeIndicatorsLayout;
      }>("/admin/reports/home-dashboard-config"),
    staleTime: 60_000,
    meta: { silentError: true },
  });

  const homeIndicators = (() => {
    const selected = normalizeHomeIndicators(homeConfig?.homeIndicators);
    if (teamLeader) {
      const salesOnly = selected.filter((k) => !k.startsWith("profit_"));
      return salesOnly.length > 0
        ? salesOnly
        : (["sales_by_supplier", "sales_by_seller"] as HomeIndicatorKey[]);
    }
    return selected;
  })();

  const homeLayout = normalizeHomeIndicatorsLayout(
    homeConfig?.homeIndicatorsLayout,
  );
  const indicatorsInGrid = homeLayout === "grid";

  const pendingCount = pendingCredit?.count ?? 0;
  const trialDays =
    user?.subscription?.status === "TRIAL"
      ? trialDaysRemaining(user.subscription.currentPeriodEnd)
      : null;

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25">
          <LayoutDashboard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {admin
              ? "Painel"
              : teamLeader
                ? "Painel do líder"
                : "Painel do gestor"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {admin
              ? "Gerencie produtos, vendedores, comissões e vendas."
              : teamLeader
                ? `Acompanhe rastreio, visitas e vendas da equipe${user?.teamName ? ` ${user.teamName}` : ""}.`
                : "Acompanhe rastreio, visitas e vendas da equipe."}
          </p>
        </div>
      </div>

      {admin && trialDays != null && trialDays > 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {trialDays === 1
            ? "Resta 1 dia no período de teste"
            : `Restam ${trialDays} dias no período de teste`}
          {" · "}
          <Link
            to="/configuracoes"
            className="font-medium text-primary hover:underline"
          >
            Assinar
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Faturamento do mês</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {scorecardLoading
              ? "…"
              : `R$ ${(scorecard?.totals.totalAmount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pedidos confirmados</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {scorecardLoading ? "…" : String(scorecard?.totals.orderCount ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ticket médio</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {scorecardLoading
              ? "…"
              : `R$ ${(scorecard?.totals.avgTicket ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          </p>
          <Link to="/relatorios" className="mt-2 inline-block text-xs text-primary hover:underline">
            Ver relatórios completos
          </Link>
        </div>
      </div>

      {admin && pendingCount > 0 ? (
        <div className="surface-card mt-6 border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <strong className="text-primary">{pendingCount}</strong>{" "}
          <span className="text-foreground">
            venda(s) aguardando análise de crédito.{" "}
            <Link to="/pedidos" className="font-medium text-primary underline">
              Ver pedidos
            </Link>
          </span>
        </div>
      ) : null}

      {teamLeader ? (
        <div className="surface-card mt-6 border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Sua equipe:{" "}
          {teamSellersLoading ? (
            <Skeleton className="inline-block h-4 w-6 align-middle" />
          ) : (
            <strong className="text-primary">{teamSellers.length}</strong>
          )}{" "}
          vendedor(es)
          {user?.teamName ? (
            <>
              {" "}
              em <strong>{user.teamName}</strong>
            </>
          ) : null}
          .
          {teamSellersFetching && !teamSellersLoading ? (
            <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-primary align-text-bottom" />
          ) : null}
        </div>
      ) : null}

      {admin ? (
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Indicadores do painel (até 3)
          </p>
          <Link
            to="/configuracoes"
            className="text-xs font-medium text-primary hover:underline"
          >
            Personalizar indicadores
          </Link>
        </div>
      ) : null}

      <div
        className={
          indicatorsInGrid
            ? "mt-6 grid gap-4 lg:grid-cols-3 sm:grid-cols-2"
            : undefined
        }
      >
        {homeIndicators.map((key) => (
          <HomeIndicatorWidget
            key={key}
            indicatorKey={key}
            compact={indicatorsInGrid}
          />
        ))}
      </div>

      <RecentSalesList
        orders={recentOrders}
        isLoading={recentOrdersLoading}
        isFetching={recentOrdersFetching}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.to} to={c.to} className="block card-hover">
              <article className="surface-card flex h-full gap-4 p-4 transition-colors hover:border-primary/30">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/12 ring-1 ring-primary/20">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground">{c.title}</h2>
                  <p className={cn("mt-1 text-sm text-muted-foreground")}>
                    {c.description}
                  </p>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
