import { useAuth } from "@/auth/AuthContext";
import { AppSelect } from "@/components/ui/app-select";
import { DateTimePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isWebAdmin, isWebTeamLeader } from "@/lib/staff";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, downloadPdf } from "../lib/api";

type Seller = { id: string; user: { name: string } };

type TeamSalesSummary = {
  generatedAt: string;
  teamName: string | null;
  period: { from: string | null; to: string | null };
  totals: { orderCount: number; totalAmount: number };
  bySeller: Array<{
    sellerId: string;
    name: string;
    orderCount: number;
    totalAmount: number;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    totalAmount: number;
  }>;
};

type DistributorInsights = {
  generatedAt: string;
  hints: {
    visitProxyDays: number;
    stagnantProductDays: number;
    churnCustomerDays: number;
    note: string;
  };
  today: {
    label: string;
    sellers: Array<{
      sellerId: string;
      name: string;
      orderCount: number;
      totalAmount: number;
    }>;
    products: Array<{
      productId: string;
      productName: string;
      quantity: number;
      totalAmount: number;
      orderCount: number;
    }>;
    suppliers: Array<{
      supplierId: string | null;
      tradeName: string;
      quantity: number;
      totalAmount: number;
      orderCount: number;
    }>;
  };
  sellersWithoutPositivacaoToday: Array<{ sellerId: string; name: string }>;
  sellersWithoutCustomers: Array<{ sellerId: string; name: string }>;
  sellersPortfolioAttention: Array<{
    sellerId: string;
    name: string;
    staleCustomersCount: number;
    assignedCustomersCount: number;
    worstCustomerDays: number | null;
    worstCustomerName: string | null;
  }>;
  stagnantProducts: Array<{
    productId: string;
    name: string;
    sku: string | null;
    daysSinceLastSale: number | null;
    lastSaleAt: string | null;
    neverSold: boolean;
  }>;
  churnCustomers: Array<{
    customerId: string;
    name: string;
    sellerName: string | null;
    daysSinceLastPurchase: number | null;
    lastPurchaseAt: string | null;
    neverPurchased: boolean;
  }>;
};

function fmtMoney(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function fmtDays(d: number | null, neverPurchased: boolean): string {
  if (neverPurchased) return "Nunca comprou";
  if (d == null) return "—";
  if (d === 0) return "Hoje";
  if (d === 1) return "1 dia";
  return `${d} dias`;
}

type MorningBriefTip = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  reason: string;
  href?: string;
};

type MorningBrief = {
  date: string;
  generatedAt: string;
  cached: boolean;
  tips: MorningBriefTip[];
};

type ExpiringLot = {
  id: string;
  lotCode: string;
  expiresAt: string;
  qty: number;
  expired: boolean;
  daysUntilExpiry: number;
  product: {
    id: string;
    name: string;
    sku: string | null;
    category: { id: string; name: string } | null;
    supplier: { id: string; tradeName: string } | null;
  };
};

export function InsightsPage() {
  const { user } = useAuth();
  const teamLeader = isWebTeamLeader(user);
  const admin = isWebAdmin(user?.role);

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
    enabled: !teamLeader,
  });

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const teamSummaryQ = useQuery({
    queryKey: ["admin", "team-summary", from, to],
    queryFn: () => {
      const q = new URLSearchParams();
      if (from) q.set("from", new Date(from).toISOString());
      if (to) q.set("to", new Date(to).toISOString());
      const suffix = q.toString() ? `?${q.toString()}` : "";
      return apiFetch<TeamSalesSummary>(`/admin/reports/team-summary${suffix}`);
    },
    enabled: teamLeader,
    staleTime: 45_000,
  });

  const insightsQ = useQuery({
    queryKey: ["admin", "reports-insights"],
    queryFn: () => apiFetch<DistributorInsights>("/admin/reports/insights"),
    staleTime: 45_000,
    enabled: !teamLeader,
  });

  const morningBriefQ = useQuery({
    queryKey: ["admin", "morning-brief"],
    queryFn: () => apiFetch<MorningBrief>("/admin/insights/morning-brief"),
    staleTime: 5 * 60_000,
    enabled: !teamLeader,
  });

  const expiringQ = useQuery({
    queryKey: ["admin", "stock-expiring"],
    queryFn: () => apiFetch<ExpiringLot[]>("/admin/stock/expiring"),
    enabled: admin,
    staleTime: 45_000,
  });

  const [sellerId, setSellerId] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function exportPdf() {
    setErr(null);
    setPending(true);
    try {
      const q = new URLSearchParams();
      if (from) q.set("from", new Date(from).toISOString());
      if (to) q.set("to", new Date(to).toISOString());
      if (sellerId) q.set("sellerId", sellerId);
      await downloadPdf(
        `/admin/reports/sales.pdf?${q.toString()}`,
        "relatorio-vendas.pdf",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao exportar");
    } finally {
      setPending(false);
    }
  }

  const ins = insightsQ.data;
  const teamSummary = teamSummaryQ.data;

  if (teamLeader) {
    return (
      <div className="space-y-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Insights da equipe
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Resumo de vendas confirmadas da sua equipe
            {user?.teamName ? ` (${user.teamName})` : ""}.
          </p>
        </div>

        <div className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <label className="block text-sm font-medium text-foreground">
              De
            </label>
            <DateTimePicker
              className="mt-1"
              value={from}
              onChange={setFrom}
              placeholder="De"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Até
            </label>
            <DateTimePicker
              className="mt-1"
              value={to}
              onChange={setTo}
              placeholder="Até"
            />
          </div>
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
            disabled={teamSummaryQ.isFetching}
            onClick={() => void teamSummaryQ.refetch()}
          >
            {teamSummaryQ.isFetching ? "Atualizando…" : "Atualizar resumo"}
          </button>
        </div>

        {teamSummaryQ.isLoading ? (
          <p className="text-muted-foreground">Montando resumo…</p>
        ) : teamSummaryQ.error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
            {(teamSummaryQ.error as Error).message}
          </p>
        ) : teamSummary ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  Pedidos confirmados
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {teamSummary.totals.orderCount}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Faturamento</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  R$ {fmtMoney(teamSummary.totals.totalAmount)}
                </p>
              </div>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">
                Por vendedor
              </h2>
              <div className="rounded-xl border border-border bg-card">
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Vendedor</TableHead>
                      <TableHead className="px-4">Pedidos</TableHead>
                      <TableHead className="px-4">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamSummary.bySeller.map((row) => (
                      <TableRow key={row.sellerId}>
                        <TableCell className="px-4 py-3 font-medium text-foreground">
                          {row.name}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">
                          {row.orderCount}
                        </TableCell>
                        <TableCell className="px-4 py-3 font-medium tabular-nums text-foreground">
                          R$ {fmtMoney(row.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">
                Produtos mais vendidos
              </h2>
              {teamSummary.topProducts.length === 0 ? (
                <p className="rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                  Nenhum produto vendido no período.
                </p>
              ) : (
                <div className="rounded-xl border border-border bg-card">
                  <Table className="min-w-[520px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4">Produto</TableHead>
                        <TableHead className="px-4">Qtd</TableHead>
                        <TableHead className="px-4">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamSummary.topProducts.map((p) => (
                        <TableRow key={p.productId}>
                          <TableCell className="px-4 py-3 font-medium text-foreground">
                            {p.productName}
                          </TableCell>
                          <TableCell className="px-4 py-3 tabular-nums text-muted-foreground">
                            {p.quantity}
                          </TableCell>
                          <TableCell className="px-4 py-3 font-medium tabular-nums text-foreground">
                            R$ {fmtMoney(p.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Insights</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Visão pronta para o dia a dia: sem filtros obrigatórios. Use o
              botão para atualizar os números; embaixo, exporte PDF quando
              precisar de arquivo.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
            disabled={insightsQ.isFetching}
            onClick={() => void insightsQ.refetch()}
          >
            {insightsQ.isFetching ? "Atualizando…" : "Atualizar painel"}
          </button>
        </div>
        {ins ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Gerado em {new Date(ins.generatedAt).toLocaleString("pt-BR")}
          </p>
        ) : null}
      </div>

      {/* Resumo da manhã — gerado 1×/dia por regras (sem LLM) */}
      <section className="rounded-xl border border-primary/25 bg-primary/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Resumo da manhã
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pontos de atenção gerados automaticamente para hoje
              {morningBriefQ.data
                ? ` (${new Date(
                    morningBriefQ.data.date + "T12:00:00",
                  ).toLocaleDateString("pt-BR")})`
                : ""}
              .
            </p>
          </div>
          {morningBriefQ.data ? (
            <p className="text-xs text-muted-foreground">
              {morningBriefQ.data.cached ? "Em cache · " : "Novo · "}
              {new Date(morningBriefQ.data.generatedAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </div>

        {morningBriefQ.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Montando resumo da manhã…
          </p>
        ) : morningBriefQ.error ? (
          <p className="mt-4 text-sm text-destructive">
            {(morningBriefQ.error as Error).message}
          </p>
        ) : morningBriefQ.data ? (
          <ul className="mt-4 space-y-3">
            {morningBriefQ.data.tips.map((tip) => {
              const badge =
                tip.severity === "critical"
                  ? "border-red-300 bg-red-50 text-red-950"
                  : tip.severity === "warning"
                    ? "border-amber-300 bg-amber-50 text-amber-950"
                    : "border-emerald-200 bg-emerald-50 text-emerald-950";
              return (
                <li
                  key={tip.id}
                  className={`rounded-lg border px-4 py-3 ${badge}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{tip.title}</p>
                    {tip.href ? (
                      <Link
                        to={tip.href}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        Abrir
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm opacity-90">{tip.reason}</p>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {admin ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Estoque com validade &lt; 30 dias
              </h2>
              <p className="text-sm text-muted-foreground">
                Lotes próximos do vencimento ou já vencidos.
              </p>
            </div>
            <Link
              to="/estoque"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ir para estoque
            </Link>
          </div>
          {expiringQ.isLoading ? (
            <p className="text-muted-foreground">Carregando validade…</p>
          ) : expiringQ.error ? (
            <p className="text-sm text-destructive">
              {(expiringQ.error as Error).message}
            </p>
          ) : (expiringQ.data?.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              Nenhum lote com validade inferior a 30 dias.
            </p>
          ) : (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Produto</TableHead>
                    <TableHead className="px-4">Lote</TableHead>
                    <TableHead className="px-4">Qtd.</TableHead>
                    <TableHead className="px-4">Validade</TableHead>
                    <TableHead className="px-4">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringQ.data!.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="px-4">
                        <div className="font-medium">{l.product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.product.supplier?.tradeName ?? "—"}
                          {l.product.category
                            ? ` · ${l.product.category.name}`
                            : ""}
                        </div>
                      </TableCell>
                      <TableCell className="px-4">{l.lotCode}</TableCell>
                      <TableCell className="px-4 tabular-nums">
                        {l.qty}
                      </TableCell>
                      <TableCell className="px-4">
                        {new Date(l.expiresAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="px-4">
                        {l.expired
                          ? "Vencido"
                          : l.daysUntilExpiry <= 0
                            ? "Vence hoje"
                            : `${l.daysUntilExpiry} dia(s)`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : null}

      {insightsQ.isLoading ? (
        <p className="text-muted-foreground">Montando seu painel…</p>
      ) : insightsQ.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
          {(insightsQ.error as Error).message}
        </p>
      ) : ins ? (
        <>
          <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">
            <p className="font-medium text-sky-900">Como lemos os dados</p>
            <p className="mt-1 text-sky-900/85">{ins.hints.note}</p>
            <ul className="mt-2 list-inside list-disc text-xs text-sky-900/75">
              <li>
                Rankings do dia: pedidos confirmados hoje (vendedor, produto e
                fornecedor).
              </li>
              <li>
                Sem positivação: vendedor ativo sem nenhum pedido confirmado no
                dia.
              </li>
              <li>
                Carteira parada: sem compra há mais de {ins.hints.visitProxyDays}{" "}
                dias neste vendedor.
              </li>
              <li>
                Produto parado: sem venda há {ins.hints.stagnantProductDays}+
                dias (cadastro antigo).
              </li>
              <li>
                Cliente sumido: sem compra há {ins.hints.churnCustomerDays}+
                dias (clientes já cadastrados há tempo).
              </li>
            </ul>
          </div>

          {/* Rankings do dia */}
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Rankings de vendas do dia
              </h2>
              <p className="text-sm text-muted-foreground">
                Pedidos confirmados — ordenados do maior para o menor
                faturamento.
              </p>
              <p className="text-xs capitalize text-muted-foreground">
                {ins.today.label}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Por vendedor
                  </h3>
                </div>
                <Table className="min-w-[280px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3 w-10">#</TableHead>
                      <TableHead className="px-3">Vendedor</TableHead>
                      <TableHead className="px-3">Pedidos</TableHead>
                      <TableHead className="px-3">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ins.today.sellers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          Nenhum vendedor ativo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ins.today.sellers.map((row, idx) => (
                        <TableRow key={row.sellerId}>
                          <TableCell className="px-3 py-2 tabular-nums text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="px-3 py-2 font-medium text-foreground">
                            {row.name}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-muted-foreground">
                            {row.orderCount}
                          </TableCell>
                          <TableCell className="px-3 py-2 font-medium tabular-nums text-foreground">
                            R$ {fmtMoney(row.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Por produto
                  </h3>
                </div>
                <Table className="min-w-[280px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3 w-10">#</TableHead>
                      <TableHead className="px-3">Produto</TableHead>
                      <TableHead className="px-3">Qtd</TableHead>
                      <TableHead className="px-3">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ins.today.products ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          Nenhuma venda de produto hoje.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (ins.today.products ?? []).map((row, idx) => (
                        <TableRow key={row.productId}>
                          <TableCell className="px-3 py-2 tabular-nums text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="px-3 py-2 font-medium text-foreground">
                            {row.productName}
                          </TableCell>
                          <TableCell className="px-3 py-2 tabular-nums text-muted-foreground">
                            {row.quantity}
                          </TableCell>
                          <TableCell className="px-3 py-2 font-medium tabular-nums text-foreground">
                            R$ {fmtMoney(row.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Por fornecedor
                  </h3>
                </div>
                <Table className="min-w-[280px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3 w-10">#</TableHead>
                      <TableHead className="px-3">Fornecedor</TableHead>
                      <TableHead className="px-3">Qtd</TableHead>
                      <TableHead className="px-3">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ins.today.suppliers ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          Nenhuma venda com fornecedor hoje.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (ins.today.suppliers ?? []).map((row, idx) => (
                        <TableRow key={row.supplierId ?? `none-${idx}`}>
                          <TableCell className="px-3 py-2 tabular-nums text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="px-3 py-2 font-medium text-foreground">
                            {row.tradeName}
                          </TableCell>
                          <TableCell className="px-3 py-2 tabular-nums text-muted-foreground">
                            {row.quantity}
                          </TableCell>
                          <TableCell className="px-3 py-2 font-medium tabular-nums text-foreground">
                            R$ {fmtMoney(row.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>

          {/* Sem positivação hoje */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Vendedores sem positivação hoje
            </h2>
            <p className="text-sm text-muted-foreground">
              Vendedores ativos sem nenhum pedido confirmado no dia.
            </p>
            {(ins.sellersWithoutPositivacaoToday ?? []).length === 0 ? (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                Todos os vendedores ativos positivaram hoje.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {(ins.sellersWithoutPositivacaoToday ?? []).map((s) => (
                  <li key={s.sellerId}>
                    <span className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-950">
                      {s.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Sem carteira */}
          {ins.sellersWithoutCustomers.length > 0 ? (
            <section className="rounded-xl border border-warning/30 bg-warning/10/60 px-4 py-4">
              <h2 className="text-lg font-semibold text-amber-950">
                Vendedores sem cliente na carteira
              </h2>
              <p className="mt-1 text-sm text-amber-950/80">
                Ninguém vinculado — nem rota nem cadastro para acompanhar.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {ins.sellersWithoutCustomers.map((s) => (
                  <li key={s.sellerId}>
                    <Link
                      to="/clientes"
                      className="inline-flex rounded-lg border border-amber-300 bg-card px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-warning/10"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Carteira parada — mantida como contexto operacional */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Carteira parada
            </h2>
            <p className="text-sm text-muted-foreground">
              Clientes na carteira sem pedido confirmado há mais de{" "}
              {ins.hints.visitProxyDays} dias.
            </p>
            {ins.sellersPortfolioAttention.length === 0 ? (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                Ninguém aparece aqui — carteiras com cliente parecem em dia pela
                última compra.
              </p>
            ) : (
              <div className="rounded-xl border border-border bg-card">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Vendedor</TableHead>
                      <TableHead className="px-4">Clientes parados</TableHead>
                      <TableHead className="px-4">Na carteira</TableHead>
                      <TableHead className="px-4">Pior caso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ins.sellersPortfolioAttention.map((row) => (
                      <TableRow key={row.sellerId}>
                        <TableCell className="px-4 py-3 font-medium text-foreground">
                          {row.name}
                        </TableCell>
                        <TableCell className="px-4 py-3 tabular-nums text-foreground">
                          {row.staleCustomersCount}
                        </TableCell>
                        <TableCell className="px-4 py-3 tabular-nums text-muted-foreground">
                          {row.assignedCustomersCount}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">
                          {row.worstCustomerName ? (
                            <>
                              <span className="font-medium text-foreground">
                                {row.worstCustomerName}
                              </span>
                              <span className="text-muted-foreground">
                                {" "}
                                ({fmtDays(row.worstCustomerDays, false)})
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* Produtos parados */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Qual produto está parado?
            </h2>
            <p className="text-sm text-muted-foreground">
              Produtos na sua base (catálogo liberado ou já vendidos) sem
              movimento há bastante tempo.
            </p>
            {ins.stagnantProducts.length === 0 ? (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                Nenhum produto encaixa neste critério agora.
              </p>
            ) : (
              <div className="rounded-xl border border-border bg-card">
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Produto</TableHead>
                      <TableHead className="px-4">SKU</TableHead>
                      <TableHead className="px-4">Situação</TableHead>
                      <TableHead className="px-4 w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ins.stagnantProducts.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="px-4 py-3 font-medium text-foreground">
                          {p.name}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">
                          {p.sku ?? "—"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">
                          {p.neverSold ? (
                            <span className="text-warning">
                              Sem histórico de venda
                            </span>
                          ) : (
                            <>
                              há{" "}
                              <span className="font-medium tabular-nums text-foreground">
                                {p.daysSinceLastSale ?? "—"}
                              </span>{" "}
                              dias
                              {p.lastSaleAt ? (
                                <span className="block text-xs text-muted-foreground">
                                  última:{" "}
                                  {new Date(p.lastSaleAt).toLocaleDateString(
                                    "pt-BR",
                                  )}
                                </span>
                              ) : null}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Link
                            to={`/produtos/${p.productId}/editar`}
                            className="text-primary hover:underline"
                          >
                            Abrir
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* Clientes */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Qual cliente não compra há 30 dias?
            </h2>
            <p className="text-sm text-muted-foreground">
              Cadastro já antigo na empresa — última compra confirmada há tempo
              ou nunca comprou.
            </p>
            {ins.churnCustomers.length === 0 ? (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                Nenhum cliente aparece aqui no momento.
              </p>
            ) : (
              <div className="rounded-xl border border-border bg-card">
                <Table className="min-w-[620px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Cliente</TableHead>
                      <TableHead className="px-4">
                        Vendedor (carteira)
                      </TableHead>
                      <TableHead className="px-4">Última compra</TableHead>
                      <TableHead className="px-4">Há quanto tempo</TableHead>
                      <TableHead className="px-4 w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ins.churnCustomers.map((c) => (
                      <TableRow key={c.customerId}>
                        <TableCell className="px-4 py-3 font-medium text-foreground">
                          {c.name}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">
                          {c.sellerName ?? "—"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">
                          {c.lastPurchaseAt
                            ? new Date(c.lastPurchaseAt).toLocaleDateString(
                                "pt-BR",
                              )
                            : "—"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-foreground">
                          {fmtDays(c.daysSinceLastPurchase, c.neverPurchased)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Link
                            to="/clientes"
                            className="text-primary hover:underline"
                          >
                            Clientes
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className="space-y-4 border-t border-border pt-10">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Exportar vendas em PDF
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Opcional — escolha período e vendedor só quando precisar do arquivo.
          </p>
        </div>

        <div className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <label className="block text-sm font-medium text-foreground">
              De
            </label>
            <DateTimePicker
              className="mt-1"
              value={from}
              onChange={setFrom}
              placeholder="De"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Até
            </label>
            <DateTimePicker
              className="mt-1"
              value={to}
              onChange={setTo}
              placeholder="Até"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Vendedor
            </label>
            <AppSelect
              className="mt-1"
              value={sellerId}
              emptyLabel="Todos"
              placeholder="Todos"
              options={sellers.map((s) => ({
                value: s.id,
                label: s.user.name,
              }))}
              onValueChange={setSellerId}
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            onClick={() => void exportPdf()}
            disabled={pending}
          >
            {pending ? "Gerando…" : "Exportar PDF"}
          </button>
        </div>
      </section>
    </div>
  );
}
