import { useAuth } from "@/auth/AuthContext";
import { apiFetch } from "@/lib/api";
import { isWebAdmin, isWebTeamLeader } from "@/lib/staff";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  LayoutDashboard,
  MapPin,
  Navigation,
  Package,
  ShoppingCart,
  Table,
  Target,
  Truck,
  UserCircle,
  Users,
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
    to: "/equipes",
    title: "Equipes",
    description: "Equipes nomeadas com líder e membros",
    icon: UsersRound,
  },
  {
    to: "/comissao",
    title: "Comissões e metas",
    description: "Faixas progressivas e metas mensais",
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
    to: "/vendas",
    title: "Vendas",
    description: "Lista e detalhes com itens e status",
    icon: ShoppingCart,
  },
  {
    to: "/relatorios",
    title: "Relatórios",
    description: "Painel e PDF opcional",
    icon: BarChart3,
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
    to: "/vendas",
    title: "Vendas",
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
    to: "/vendas",
    title: "Vendas",
    description: "Pedidos confirmados da equipe",
    icon: ShoppingCart,
  },
  {
    to: "/relatorios",
    title: "Relatórios da equipe",
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

  const { data: teamSellers = [] } = useQuery({
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
  });

  const pendingCount = pendingCredit?.count ?? 0;

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

      {admin && pendingCount > 0 ? (
        <div className="surface-card mt-6 border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <strong className="text-primary">{pendingCount}</strong>{" "}
          <span className="text-foreground">
            venda(s) aguardando análise de crédito.{" "}
            <Link to="/vendas" className="font-medium text-primary underline">
              Ver vendas
            </Link>
          </span>
        </div>
      ) : null}

      {teamLeader ? (
        <div className="surface-card mt-6 border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Sua equipe:{" "}
          <strong className="text-primary">{teamSellers.length}</strong>{" "}
          vendedor(es)
          {user?.teamName ? (
            <>
              {" "}
              em <strong>{user.teamName}</strong>
            </>
          ) : null}
          .
        </div>
      ) : null}

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
