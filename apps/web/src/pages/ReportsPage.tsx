import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, downloadPdf } from "../lib/api";

type Seller = { id: string; user: { name: string } };

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
  };
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

export function ReportsPage() {
  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const insightsQ = useQuery({
    queryKey: ["admin", "reports-insights"],
    queryFn: () => apiFetch<DistributorInsights>("/admin/reports/insights"),
    staleTime: 45_000,
  });

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
      await downloadPdf(`/admin/reports/sales.pdf?${q.toString()}`, "relatorio-vendas.pdf");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao exportar");
    } finally {
      setPending(false);
    }
  }

  const ins = insightsQ.data;

  return (
    <div className="space-y-10">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Visão pronta para o dia a dia: sem filtros obrigatórios. Use o botão para atualizar os números; embaixo,
              exporte PDF quando precisar de arquivo.
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
              <li>Carteira “parada”: sem compra há mais de {ins.hints.visitProxyDays} dias neste vendedor.</li>
              <li>Produto parado: sem venda há {ins.hints.stagnantProductDays}+ dias (cadastro antigo).</li>
              <li>Cliente sumido: sem compra há {ins.hints.churnCustomerDays}+ dias (clientes já cadastrados há tempo).</li>
            </ul>
          </div>

          {/* Quem vendeu menos hoje */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Quem vendeu menos hoje?</h2>
            <p className="text-sm text-muted-foreground">Pedidos confirmados — lista do menor para o maior faturamento.</p>
            <p className="text-xs capitalize text-muted-foreground">{ins.today.label}</p>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-background text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Vendedor</th>
                    <th className="px-4 py-3">Pedidos</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ins.today.sellers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                        Nenhum vendedor ativo — cadastre vendedores primeiro.
                      </td>
                    </tr>
                  ) : (
                    ins.today.sellers.map((row) => (
                      <tr key={row.sellerId} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {row.name}
                          {row.orderCount === 0 ? (
                            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-warning">
                              Zerado hoje
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.orderCount}</td>
                        <td className="px-4 py-3 font-medium tabular-nums text-foreground">
                          R$ {fmtMoney(row.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Sem carteira */}
          {ins.sellersWithoutCustomers.length > 0 ? (
            <section className="rounded-xl border border-warning/30 bg-warning/10/60 px-4 py-4">
              <h2 className="text-lg font-semibold text-amber-950">Vendedores sem cliente na carteira</h2>
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

          {/* Carteira parada */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Qual vendedor está “sem ir ao cliente”?</h2>
            <p className="text-sm text-muted-foreground">
              Na prática: clientes na carteira dele sem pedido confirmado há mais de {ins.hints.visitProxyDays} dias.
            </p>
            {ins.sellersPortfolioAttention.length === 0 ? (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                Ninguém aparece aqui — carteiras com cliente parecem em dia pela última compra.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-background text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Vendedor</th>
                      <th className="px-4 py-3">Clientes parados</th>
                      <th className="px-4 py-3">Na carteira</th>
                      <th className="px-4 py-3">Pior caso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ins.sellersPortfolioAttention.map((row) => (
                      <tr key={row.sellerId} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                        <td className="px-4 py-3 tabular-nums text-foreground">{row.staleCustomersCount}</td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.assignedCustomersCount}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.worstCustomerName ? (
                            <>
                              <span className="font-medium text-foreground">{row.worstCustomerName}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                ({fmtDays(row.worstCustomerDays, false)})
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Produtos parados */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Qual produto está parado?</h2>
            <p className="text-sm text-muted-foreground">
              Produtos na sua base (catálogo liberado ou já vendidos) sem movimento há bastante tempo.
            </p>
            {ins.stagnantProducts.length === 0 ? (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                Nenhum produto encaixa neste critério agora.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-background text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Situação</th>
                      <th className="px-4 py-3 w-28" />
                    </tr>
                  </thead>
                  <tbody>
                    {ins.stagnantProducts.map((p) => (
                      <tr key={p.productId} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.sku ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.neverSold ? (
                            <span className="text-warning">Sem histórico de venda</span>
                          ) : (
                            <>
                              há{" "}
                              <span className="font-medium tabular-nums text-foreground">
                                {p.daysSinceLastSale ?? "—"}
                              </span>{" "}
                              dias
                              {p.lastSaleAt ? (
                                <span className="block text-xs text-muted-foreground">
                                  última: {new Date(p.lastSaleAt).toLocaleDateString("pt-BR")}
                                </span>
                              ) : null}
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/produtos/${p.productId}/editar`}
                            className="text-primary hover:underline"
                          >
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Clientes */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Qual cliente não compra há 30 dias?</h2>
            <p className="text-sm text-muted-foreground">
              Cadastro já antigo na empresa — última compra confirmada há tempo ou nunca comprou.
            </p>
            {ins.churnCustomers.length === 0 ? (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                Nenhum cliente aparece aqui no momento.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-background text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Vendedor (carteira)</th>
                      <th className="px-4 py-3">Última compra</th>
                      <th className="px-4 py-3">Há quanto tempo</th>
                      <th className="px-4 py-3 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {ins.churnCustomers.map((c) => (
                      <tr key={c.customerId} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.sellerName ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.lastPurchaseAt
                            ? new Date(c.lastPurchaseAt).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-foreground">{fmtDays(c.daysSinceLastPurchase, c.neverPurchased)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link to="/clientes" className="text-primary hover:underline">
                            Clientes
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className="space-y-4 border-t border-border pt-10">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Exportar vendas em PDF</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Opcional — escolha período e vendedor só quando precisar do arquivo.
          </p>
        </div>

        <div className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <label className="block text-sm font-medium text-foreground">De</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Até</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Vendedor</label>
            <select
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
            >
              <option value="">Todos</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.user.name}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
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
