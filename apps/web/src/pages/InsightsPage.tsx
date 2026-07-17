import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

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

/** Indicadores e insights operacionais para o dono / gestão. */
export function InsightsPage() {
  const insightsQ = useQuery({
    queryKey: ["admin", "reports-insights"],
    queryFn: () => apiFetch<DistributorInsights>("/admin/reports/insights"),
    staleTime: 45_000,
  });

  const ins = insightsQ.data;

  return (
    <div className="space-y-10">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Indicadores</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Insights do dia a dia para o dono da empresa: quem está atrasando, o
              que parou de girar e quem precisa de atenção na carteira.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
            disabled={insightsQ.isFetching}
            onClick={() => void insightsQ.refetch()}
          >
            {insightsQ.isFetching ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
        {ins ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Gerado em {new Date(ins.generatedAt).toLocaleString("pt-BR")}
          </p>
        ) : null}
      </div>

      {insightsQ.isLoading ? (
        <p className="text-muted-foreground">Montando indicadores…</p>
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
                Carteira “parada”: sem compra há mais de {ins.hints.visitProxyDays}{" "}
                dias neste vendedor.
              </li>
              <li>
                Produto parado: sem venda há {ins.hints.stagnantProductDays}+ dias
                (cadastro antigo).
              </li>
              <li>
                Cliente sumido: sem compra há {ins.hints.churnCustomerDays}+ dias
                (clientes já cadastrados há tempo).
              </li>
            </ul>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Quem vendeu menos hoje?
            </h2>
            <p className="text-sm text-muted-foreground">
              Pedidos confirmados — lista do menor para o maior faturamento.
            </p>
            <p className="text-xs capitalize text-muted-foreground">{ins.today.label}</p>
            <div className="rounded-xl border border-border bg-card">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Vendedor</TableHead>
                    <TableHead className="px-4">Pedidos</TableHead>
                    <TableHead className="px-4">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ins.today.sellers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        Nenhum vendedor ativo — cadastre vendedores primeiro.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ins.today.sellers.map((row) => (
                      <TableRow key={row.sellerId}>
                        <TableCell className="px-4 py-3 font-medium text-foreground">
                          {row.name}
                          {row.orderCount === 0 ? (
                            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-warning">
                              Zerado hoje
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">
                          {row.orderCount}
                        </TableCell>
                        <TableCell className="px-4 py-3 font-medium tabular-nums text-foreground">
                          R$ {fmtMoney(row.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          {ins.sellersWithoutCustomers.length > 0 ? (
            <section className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-4">
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

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Qual vendedor está “sem ir ao cliente”?
            </h2>
            <p className="text-sm text-muted-foreground">
              Na prática: clientes na carteira dele sem pedido confirmado há mais
              de {ins.hints.visitProxyDays} dias.
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

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Qual produto está parado?
            </h2>
            <p className="text-sm text-muted-foreground">
              Produtos na sua base (catálogo liberado ou já vendidos) sem movimento
              há bastante tempo.
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
                                  última:{" "}
                                  {new Date(p.lastSaleAt).toLocaleDateString("pt-BR")}
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

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Qual cliente não compra há 30 dias?
            </h2>
            <p className="text-sm text-muted-foreground">
              Cadastro já antigo na empresa — última compra confirmada há tempo ou
              nunca comprou.
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
                      <TableHead className="px-4">Vendedor (carteira)</TableHead>
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
                            ? new Date(c.lastPurchaseAt).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-foreground">
                          {fmtDays(c.daysSinceLastPurchase, c.neverPurchased)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Link to="/clientes" className="text-primary hover:underline">
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
    </div>
  );
}
