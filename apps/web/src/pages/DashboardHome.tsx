import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { isWebAdmin } from "../lib/staff";

const adminCards = [
  { to: "/tabelas-preco", title: "Tabelas de preço", description: "Tabelas e preços por produto" },
  { to: "/produtos", title: "Produtos", description: "Lista, edição e base de cadastro" },
  { to: "/vendedores", title: "Vendedores", description: "Comissão, gestor de equipe e produtos liberados" },
  { to: "/comissao", title: "Comissões e metas", description: "Faixas progressivas e metas mensais" },
  { to: "/clientes", title: "Clientes", description: "Cadastro e vínculo com vendedor" },
  { to: "/rastreio", title: "Rastreio ao vivo", description: "Mapa com posição dos vendedores em tempo real" },
  { to: "/visitas", title: "Visitas em campo", description: "Check-ins com GPS e duração" },
  { to: "/vendas", title: "Vendas", description: "Lista e detalhes com itens e status" },
  { to: "/relatorios", title: "Relatórios", description: "Painel e PDF opcional" },
] as const;

const managerCards = [
  { to: "/rastreio", title: "Rastreio ao vivo", description: "Acompanhe a sua equipe no mapa" },
  { to: "/visitas", title: "Visitas em campo", description: "Check-ins dos vendedores da equipe" },
  { to: "/vendas", title: "Vendas", description: "Pedidos da equipe (somente leitura)" },
] as const;

export function DashboardHome() {
  const { user } = useAuth();
  const admin = isWebAdmin(user?.role);
  const cards = admin ? adminCards : managerCards;

  const { data: pendingCredit } = useQuery({
    queryKey: ["admin", "pending-credit-summary"],
    queryFn: () => apiFetch<{ count: number }>("/admin/orders/pending-credit-summary"),
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    enabled: admin,
  });

  const pendingCount = pendingCredit?.count ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        {admin ? "Painel" : "Painel do gestor"}
      </h1>
      <p className="mt-2 text-slate-600">
        {admin
          ? "Gerencie produtos, vendedores, comissões, clientes e acompanhe as vendas."
          : "Acompanhe a sua equipe: rastreio em tempo real, visitas e vendas."}
      </p>

      {admin && pendingCount > 0 ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{pendingCount}</strong> venda(s) aguardando análise de crédito.{" "}
          <Link to="/vendas" className="font-medium underline">
            Ver vendas
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
          >
            <h2 className="font-semibold text-slate-900">{c.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
