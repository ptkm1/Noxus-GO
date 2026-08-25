import {
  fmtDateTime,
  fmtMoney,
  fmtPct,
  PeriodPresetBar,
  ReportDataLayout,
  ReportKpis,
  SellerFilterField,
  usePeriodState,
  useReportSellers,
} from "@/components/reports/ReportDataKit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type CreditAging = {
  totals: {
    openBalance: number;
    blockedCustomers: number;
    overLimitCustomers: number;
    buckets: {
      current: number;
      d1_30: number;
      d31_60: number;
      d61_90: number;
      d90_plus: number;
    };
  };
  customers: Array<{
    customerId: string;
    name: string;
    sellerName: string | null;
    openBalance: number;
    creditBlocked: boolean;
    overLimit: boolean;
    limitUtilizationPct: number | null;
    buckets: {
      current: number;
      d1_30: number;
      d31_60: number;
      d61_90: number;
      d90_plus: number;
    };
  }>;
};

type PortfolioBySeller = {
  totals: {
    openBalance: number;
    overdueBalance: number;
    customersWithOpenCredit: number;
  };
  rows: Array<{
    sellerId: string | null;
    sellerName: string;
    assignedCustomers: number;
    customersWithOpenCredit: number;
    blockedCustomers: number;
    overLimitCustomers: number;
    openBalance: number;
    overdueBalance: number;
  }>;
};

type Positivacao = {
  totals: {
    customerCount: number;
    positivados: number;
    semPositivacao: number;
    positivacaoPct: number;
    totalAmount: number;
  };
  positivados: Array<{
    customerId: string;
    name: string;
    sellerName: string | null;
    orderCount: number;
    totalAmount: number;
    lastPurchaseAt: string | null;
  }>;
  semPositivacao: Array<{
    customerId: string;
    name: string;
    sellerName: string | null;
  }>;
};

type AbcReport = {
  totals: {
    customerCount: number;
    totalAmount: number;
    classCounts: { A: number; B: number; C: number };
  };
  rows: Array<{
    customerId: string;
    name: string;
    sellerName: string | null;
    rank: number;
    orderCount: number;
    totalAmount: number;
    sharePct: number;
    cumulativePct: number;
    abcClass: "A" | "B" | "C";
  }>;
};

type VisitEffectiveness = {
  totals: {
    visits: number;
    converted: number;
    conversionRate: number;
    convertedAmount: number;
    coveragePct: number;
    visitedCustomers: number;
    assignedCustomers: number;
  };
  bySeller: Array<{
    sellerId: string;
    name: string;
    visits: number;
    converted: number;
    conversionRate: number;
    revenue: number;
  }>;
};

export function ReportPortfolioPage() {
  const q = useQuery({
    queryKey: ["admin", "reports", "credit-aging"],
    queryFn: () =>
      apiFetch<CreditAging>("/admin/reports/credit-aging"),
  });

  return (
    <ReportDataLayout
      title="Situação da carteira de clientes"
      description="Títulos em aberto, aging de vencimento e clientes bloqueados ou acima do limite."
    >
      {q.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : q.isError ? (
        <p className="text-destructive">
          {q.error instanceof Error ? q.error.message : "Falha ao carregar"}
        </p>
      ) : q.data ? (
        <div className="space-y-6">
          <ReportKpis
            items={[
              {
                label: "Em aberto",
                value: `R$ ${fmtMoney(q.data.totals.openBalance)}`,
              },
              {
                label: "Bloqueados",
                value: String(q.data.totals.blockedCustomers),
              },
              {
                label: "Acima do limite",
                value: String(q.data.totals.overLimitCustomers),
              },
              {
                label: "A vencer",
                value: `R$ ${fmtMoney(q.data.totals.buckets.current)}`,
              },
            ]}
          />
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Cliente</TableHead>
                  <TableHead className="px-4">Vendedor</TableHead>
                  <TableHead className="px-4">Saldo</TableHead>
                  <TableHead className="px-4">1–30</TableHead>
                  <TableHead className="px-4">31–60</TableHead>
                  <TableHead className="px-4">61–90</TableHead>
                  <TableHead className="px-4">90+</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.customers.map((c) => (
                  <TableRow key={c.customerId}>
                    <TableCell className="px-4 py-2">{c.name}</TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      {c.sellerName ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      R$ {fmtMoney(c.openBalance)}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      {fmtMoney(c.buckets.d1_30)}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      {fmtMoney(c.buckets.d31_60)}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      {fmtMoney(c.buckets.d61_90)}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      {fmtMoney(c.buckets.d90_plus)}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-sm">
                      {c.creditBlocked
                        ? "Bloqueado"
                        : c.overLimit
                          ? "Acima do limite"
                          : "OK"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </ReportDataLayout>
  );
}

export function ReportPortfolioBySellerPage() {
  const q = useQuery({
    queryKey: ["admin", "reports", "portfolio-by-seller"],
    queryFn: () =>
      apiFetch<PortfolioBySeller>("/admin/reports/portfolio-by-seller"),
  });

  return (
    <ReportDataLayout
      title="Carteira por vendedor"
      description="Clientes atribuídos, crédito em aberto e inadimplência agrupados por vendedor."
    >
      {q.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : q.isError ? (
        <p className="text-destructive">
          {q.error instanceof Error ? q.error.message : "Falha ao carregar"}
        </p>
      ) : q.data ? (
        <div className="space-y-6">
          <ReportKpis
            items={[
              {
                label: "Em aberto",
                value: `R$ ${fmtMoney(q.data.totals.openBalance)}`,
              },
              {
                label: "Vencido",
                value: `R$ ${fmtMoney(q.data.totals.overdueBalance)}`,
              },
              {
                label: "Clientes c/ crédito",
                value: String(q.data.totals.customersWithOpenCredit),
              },
            ]}
          />
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Vendedor</TableHead>
                  <TableHead className="px-4">Carteira</TableHead>
                  <TableHead className="px-4">C/ aberto</TableHead>
                  <TableHead className="px-4">Bloqueados</TableHead>
                  <TableHead className="px-4">Acima limite</TableHead>
                  <TableHead className="px-4">Aberto</TableHead>
                  <TableHead className="px-4">Vencido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.rows.map((r) => (
                  <TableRow key={r.sellerId ?? r.sellerName}>
                    <TableCell className="px-4 py-2">{r.sellerName}</TableCell>
                    <TableCell className="px-4 py-2">
                      {r.assignedCustomers}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      {r.customersWithOpenCredit}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      {r.blockedCustomers}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      {r.overLimitCustomers}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      R$ {fmtMoney(r.openBalance)}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      R$ {fmtMoney(r.overdueBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </ReportDataLayout>
  );
}

export function ReportCustomerPositivacaoPage() {
  const { preset, setPreset, range } = usePeriodState();
  const { data: sellers = [] } = useReportSellers();
  const [sellerId, setSellerId] = useState("");
  const [tab, setTab] = useState<"ok" | "missing">("ok");

  const q = useQuery({
    queryKey: [
      "admin",
      "reports",
      "customer-positivacao",
      range.from,
      range.to,
      sellerId,
    ],
    queryFn: () => {
      const p = new URLSearchParams({
        from: range.from,
        to: range.to,
      });
      if (sellerId) p.set("sellerId", sellerId);
      return apiFetch<Positivacao>(
        `/admin/reports/customer-positivacao?${p.toString()}`,
      );
    },
  });

  return (
    <ReportDataLayout
      title="Positivação de clientes"
      description="Clientes ativos que compraram (ou não) no período selecionado."
      filters={
        <>
          <PeriodPresetBar preset={preset} onPreset={setPreset} />
          <SellerFilterField
            value={sellerId}
            onChange={setSellerId}
            sellers={sellers}
          />
        </>
      }
    >
      {q.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : q.data ? (
        <div className="space-y-6">
          <ReportKpis
            items={[
              {
                label: "Clientes",
                value: String(q.data.totals.customerCount),
              },
              {
                label: "Positivados",
                value: String(q.data.totals.positivados),
              },
              {
                label: "Sem compra",
                value: String(q.data.totals.semPositivacao),
              },
              {
                label: "% positivação",
                value: fmtPct(q.data.totals.positivacaoPct),
              },
            ]}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                tab === "ok"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
              onClick={() => setTab("ok")}
            >
              Positivados
            </button>
            <button
              type="button"
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                tab === "missing"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
              onClick={() => setTab("missing")}
            >
              Sem positivação
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Cliente</TableHead>
                  <TableHead className="px-4">Vendedor</TableHead>
                  {tab === "ok" ? (
                    <>
                      <TableHead className="px-4">Pedidos</TableHead>
                      <TableHead className="px-4">Total</TableHead>
                      <TableHead className="px-4">Última compra</TableHead>
                    </>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tab === "ok"
                  ? q.data.positivados.map((r) => (
                      <TableRow key={r.customerId}>
                        <TableCell className="px-4 py-2">{r.name}</TableCell>
                        <TableCell className="px-4 py-2 text-muted-foreground">
                          {r.sellerName ?? "—"}
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          {r.orderCount}
                        </TableCell>
                        <TableCell className="px-4 py-2 tabular-nums">
                          R$ {fmtMoney(r.totalAmount)}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-sm text-muted-foreground">
                          {fmtDateTime(r.lastPurchaseAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  : q.data.semPositivacao.map((r) => (
                      <TableRow key={r.customerId}>
                        <TableCell className="px-4 py-2">{r.name}</TableCell>
                        <TableCell className="px-4 py-2 text-muted-foreground">
                          {r.sellerName ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </ReportDataLayout>
  );
}

export function ReportCustomerAbcPage() {
  const { preset, setPreset, range } = usePeriodState();
  const { data: sellers = [] } = useReportSellers();
  const [sellerId, setSellerId] = useState("");

  const q = useQuery({
    queryKey: [
      "admin",
      "reports",
      "customer-abc",
      range.from,
      range.to,
      sellerId,
    ],
    queryFn: () => {
      const p = new URLSearchParams({ from: range.from, to: range.to });
      if (sellerId) p.set("sellerId", sellerId);
      return apiFetch<AbcReport>(`/admin/reports/customer-abc?${p.toString()}`);
    },
  });

  return (
    <ReportDataLayout
      title="Curva ABC de clientes"
      description="Classificação A/B/C pelo faturamento confirmado no período (80% / 15% / 5%)."
      filters={
        <>
          <PeriodPresetBar preset={preset} onPreset={setPreset} />
          <SellerFilterField
            value={sellerId}
            onChange={setSellerId}
            sellers={sellers}
          />
        </>
      }
    >
      {q.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : q.data ? (
        <div className="space-y-6">
          <ReportKpis
            items={[
              {
                label: "Clientes",
                value: String(q.data.totals.customerCount),
              },
              {
                label: "Faturamento",
                value: `R$ ${fmtMoney(q.data.totals.totalAmount)}`,
              },
              {
                label: "Classe A",
                value: String(q.data.totals.classCounts.A),
              },
              {
                label: "B / C",
                value: `${q.data.totals.classCounts.B} / ${q.data.totals.classCounts.C}`,
              },
            ]}
          />
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">#</TableHead>
                  <TableHead className="px-4">ABC</TableHead>
                  <TableHead className="px-4">Cliente</TableHead>
                  <TableHead className="px-4">Vendedor</TableHead>
                  <TableHead className="px-4">Pedidos</TableHead>
                  <TableHead className="px-4">Total</TableHead>
                  <TableHead className="px-4">% part.</TableHead>
                  <TableHead className="px-4">% acum.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.rows.map((r) => (
                  <TableRow key={r.customerId}>
                    <TableCell className="px-4 py-2">{r.rank}</TableCell>
                    <TableCell className="px-4 py-2 font-semibold">
                      {r.abcClass}
                    </TableCell>
                    <TableCell className="px-4 py-2">{r.name}</TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      {r.sellerName ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2">{r.orderCount}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      R$ {fmtMoney(r.totalAmount)}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      {fmtPct(r.sharePct)}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      {fmtPct(r.cumulativePct)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </ReportDataLayout>
  );
}

export function ReportVisitsCheckinPage() {
  const { preset, setPreset, range } = usePeriodState();
  const q = useQuery({
    queryKey: [
      "admin",
      "reports",
      "visit-effectiveness",
      range.from,
      range.to,
    ],
    queryFn: () =>
      apiFetch<VisitEffectiveness>(
        `/admin/reports/visit-effectiveness?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      ),
  });

  return (
    <ReportDataLayout
      title="Visitas com check-in"
      description="Visitas registradas no período, conversão em venda e detalhe por vendedor."
      filters={<PeriodPresetBar preset={preset} onPreset={setPreset} />}
    >
      {q.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : q.isError ? (
        <p className="text-destructive">
          {q.error instanceof Error ? q.error.message : "Falha ao carregar"}
        </p>
      ) : q.data ? (
        <div className="space-y-6">
          <ReportKpis
            items={[
              {
                label: "Visitas",
                value: String(q.data.totals.visits),
              },
              {
                label: "Clientes visitados",
                value: String(q.data.totals.visitedCustomers),
              },
              {
                label: "Convertidas",
                value: String(q.data.totals.converted),
              },
              {
                label: "Conversão",
                value: fmtPct(q.data.totals.conversionRate),
              },
            ]}
          />
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Vendedor</TableHead>
                  <TableHead className="px-4">Visitas</TableHead>
                  <TableHead className="px-4">Convertidas</TableHead>
                  <TableHead className="px-4">%</TableHead>
                  <TableHead className="px-4">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.bySeller.map((r) => (
                  <TableRow key={r.sellerId}>
                    <TableCell className="px-4 py-2">{r.name}</TableCell>
                    <TableCell className="px-4 py-2">{r.visits}</TableCell>
                    <TableCell className="px-4 py-2">{r.converted}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      {fmtPct(r.conversionRate)}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      R$ {fmtMoney(r.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </ReportDataLayout>
  );
}
