import {
  DateRangeField,
  ReportField,
  ReportFormLayout,
  toIsoRange,
} from "@/components/reports/ReportFormKit";
import {
  fmtMoney,
  PeriodPresetBar,
  ReportDataLayout,
  ReportKpis,
  usePeriodState,
  useReportSellers,
} from "@/components/reports/ReportDataKit";
import { AppSelect } from "@/components/ui/app-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, downloadPdf } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type Scorecard = {
  totals: { orderCount: number; totalAmount: number; avgTicket: number };
  bySeller: Array<{
    sellerId: string;
    name: string;
    orderCount: number;
    totalAmount: number;
  }>;
  byTeam: Array<{
    teamId: string;
    teamName: string;
    orderCount: number;
    totalAmount: number;
  }>;
  daily: Array<{ date: string; orderCount: number; totalAmount: number }>;
};

type CommissionStatement = {
  bySeller: Array<{
    sellerId: string;
    name: string;
    orderCount: number;
    revenue: number;
    commission: number;
    goalTarget: number | null;
    goalPct: number | null;
  }>;
};

/** Resumo de vendas — scorecard do período. */
export function ReportSalesSummaryPage() {
  const { preset, setPreset, range } = usePeriodState();
  const q = useQuery({
    queryKey: ["admin", "reports", "scorecard", range.from, range.to],
    queryFn: () =>
      apiFetch<Scorecard>(
        `/admin/reports/scorecard?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      ),
  });

  return (
    <ReportDataLayout
      title="Resumo de vendas"
      description="Totais, ticket médio, ranking por vendedor e evolução diária no período."
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
                label: "Pedidos",
                value: String(q.data.totals.orderCount),
              },
              {
                label: "Faturamento",
                value: `R$ ${fmtMoney(q.data.totals.totalAmount)}`,
              },
              {
                label: "Ticket médio",
                value: `R$ ${fmtMoney(q.data.totals.avgTicket)}`,
              },
              {
                label: "Vendedores",
                value: String(q.data.bySeller.length),
              },
            ]}
          />
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Vendedor</TableHead>
                  <TableHead className="px-4">Pedidos</TableHead>
                  <TableHead className="px-4">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.bySeller.map((r) => (
                  <TableRow key={r.sellerId}>
                    <TableCell className="px-4 py-2">{r.name}</TableCell>
                    <TableCell className="px-4 py-2">{r.orderCount}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      R$ {fmtMoney(r.totalAmount)}
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

/** Vendas detalhadas — PDF com pedidos e itens. */
export function ReportSalesDetailedPage() {
  const { data: sellers = [] } = useReportSellers();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setErr(null);
    setPending(true);
    try {
      const q = new URLSearchParams();
      const iso = toIsoRange(from, to);
      if (iso.from) q.set("from", iso.from);
      if (iso.to) q.set("to", iso.to);
      if (sellerId) q.set("sellerId", sellerId);
      await downloadPdf(
        `/admin/reports/sales.pdf?${q.toString()}`,
        "vendas-detalhadas.pdf",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao gerar PDF");
    } finally {
      setPending(false);
    }
  }

  return (
    <ReportFormLayout
      title="Vendas detalhadas"
      onClear={() => {
        setFrom("");
        setTo("");
        setSellerId("");
        setErr(null);
      }}
      onGenerate={() => void generate()}
      generating={pending}
    >
      <ReportField label="Período">
        <DateRangeField
          from={from}
          to={to}
          onChange={(a, b) => {
            setFrom(a);
            setTo(b);
          }}
        />
      </ReportField>
      <ReportField label="Vendedor">
        <AppSelect
          value={sellerId}
          onValueChange={setSellerId}
          emptyLabel="Todos"
          options={sellers.map((s) => ({
            value: s.id,
            label: s.user.name,
          }))}
        />
      </ReportField>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <p className="text-sm text-muted-foreground">
        Gera um PDF com cada pedido confirmado e suas linhas de itens no
        período.
      </p>
    </ReportFormLayout>
  );
}

/** Ranking de vendedor / meta. */
export function ReportSellerRankingPage() {
  const { preset, setPreset, range } = usePeriodState();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const scorecardQ = useQuery({
    queryKey: ["admin", "reports", "scorecard", range.from, range.to],
    queryFn: () =>
      apiFetch<Scorecard>(
        `/admin/reports/scorecard?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      ),
  });

  const goalsQ = useQuery({
    queryKey: ["admin", "reports", "commission", year, month],
    queryFn: () =>
      apiFetch<CommissionStatement>(
        `/admin/reports/commission-statement?year=${year}&month=${month}`,
      ),
  });

  const goalBySeller = new Map(
    (goalsQ.data?.bySeller ?? []).map((r) => [r.sellerId, r]),
  );

  return (
    <ReportDataLayout
      title="Ranking de vendedor / Meta"
      description="Ranking de vendas no período e progresso das metas do mês selecionado."
      filters={
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Período do ranking
            </p>
            <PeriodPresetBar preset={preset} onPreset={setPreset} />
          </div>
          <div className="flex flex-wrap gap-3">
            <AppSelect
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
              options={Array.from({ length: 12 }, (_, i) => ({
                value: String(i + 1),
                label: new Date(2000, i, 1).toLocaleString("pt-BR", {
                  month: "long",
                }),
              }))}
            />
            <AppSelect
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
              options={[year - 1, year, year + 1].map((y) => ({
                value: String(y),
                label: String(y),
              }))}
            />
          </div>
        </>
      }
    >
      {scorecardQ.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : scorecardQ.data ? (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">#</TableHead>
                <TableHead className="px-4">Vendedor</TableHead>
                <TableHead className="px-4">Pedidos</TableHead>
                <TableHead className="px-4">Vendas</TableHead>
                <TableHead className="px-4">Meta</TableHead>
                <TableHead className="px-4">% meta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scorecardQ.data.bySeller.map((r, i) => {
                const g = goalBySeller.get(r.sellerId);
                return (
                  <TableRow key={r.sellerId}>
                    <TableCell className="px-4 py-2 tabular-nums">
                      {i + 1}
                    </TableCell>
                    <TableCell className="px-4 py-2">{r.name}</TableCell>
                    <TableCell className="px-4 py-2">{r.orderCount}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      R$ {fmtMoney(r.totalAmount)}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums text-muted-foreground">
                      {g?.goalTarget != null
                        ? `R$ ${fmtMoney(g.goalTarget)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      {g?.goalPct != null ? `${fmtMoney(g.goalPct)}%` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </ReportDataLayout>
  );
}
