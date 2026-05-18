import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

const cards = [
  {
    to: "/tabelas-preco",
    title: "Tabelas de preço",
    description: "Tabelas e preços por produto",
  },
  {
    to: "/produtos",
    title: "Produtos",
    description: "Lista, edição e base de cadastro",
  },
  {
    to: "/vendedores",
    title: "Vendedores",
    description: "Comissão e produtos liberados",
  },
  {
    to: "/comissao",
    title: "Comissões e metas",
    description: "Faixas progressivas, metas mensais e visão no app do vendedor",
  },
  {
    to: "/clientes",
    title: "Clientes",
    description: "Cadastro e vínculo com vendedor",
  },
  {
    to: "/vendas",
    title: "Vendas",
    description: "Lista e detalhes com itens e status",
  },
  {
    to: "/relatorios",
    title: "Relatórios",
    description: "Painel pronto (vendas do dia, carteira, produtos, clientes) e PDF opcional",
  },
] as const;

export function DashboardHome() {
  const { data: pendingCredit } = useQuery({
    queryKey: ["admin", "pending-credit-summary"],
    queryFn: () => apiFetch<{ count: number }>("/admin/orders/pending-credit-summary"),
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const pendingCount = pendingCredit?.count ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Painel</h1>
      <p className="mt-2 text-slate-600">
        Gerencie produtos, vendedores, comissões, clientes e acompanhe as vendas.
      </p>

      {pendingCount > 0 ? (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm">
          <p className="font-medium">
            {pendingCount === 1
              ? "Há 1 pedido aguardando aprovação de crédito."
              : `Há ${pendingCount} pedidos aguardando aprovação de crédito.`}
          </p>
          <p className="mt-1 text-sm text-amber-900/90">
            Revise em Vendas ou abra os alertas quando um vendedor enviar um pedido para análise.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              to="/vendas?status=PENDING_CREDIT_APPROVAL"
              className="inline-flex rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              Ver fila de crédito
            </Link>
            <Link
              to="/notificacoes"
              className="inline-flex rounded-lg border border-amber-600 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Alertas
            </Link>
          </div>
        </div>
      ) : null}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <li key={c.to}>
            <Link
              to={c.to}
              className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300"
            >
              <h2 className="font-medium text-slate-900">{c.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{c.description}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Atalhos</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/produtos/categorias"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Categorias de produto
          </Link>
          <Link
            to="/produtos/novo"
            className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Novo produto
          </Link>
          <Link
            to="/clientes"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Novo cliente
          </Link>
          <Link
            to="/tabelas-preco"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Tabelas de preço
          </Link>
          <Link
            to="/relatorios"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Painel do distribuidor
          </Link>
          <Link
            to="/vendas"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver vendas
          </Link>
          <Link
            to="/comissao"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Comissões e metas
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Para editar um produto já cadastrado, abra{" "}
          <Link to="/produtos" className="text-brand-600 hover:underline">
            Produtos
          </Link>{" "}
          e use <strong className="font-medium text-slate-600">Editar</strong> na lista.
        </p>
      </div>
    </div>
  );
}
