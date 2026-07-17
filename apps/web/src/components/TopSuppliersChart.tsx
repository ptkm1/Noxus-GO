import { apiFetch } from "@/lib/api";
import {
  PERIOD_PRESET_LABELS,
  periodRange,
  type PeriodPreset,
} from "@/lib/period-presets";
import { cn } from "@/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SalesBySupplierSummary = {
  period: { from: string; to: string };
  totals: { totalAmount: number; orderCount: number };
  topSuppliers: Array<{
    supplierId: string | null;
    tradeName: string;
    totalAmount: number;
    orderCount: number;
  }>;
};

function fmtMoney(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PRESETS: PeriodPreset[] = [
  "this_month",
  "last_month",
  "last_7_days",
  "last_90_days",
];

export function TopSuppliersChart() {
  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const range = useMemo(() => periodRange(preset), [preset]);

  const q = useQuery({
    queryKey: ["admin", "sales-by-supplier", range.from, range.to],
    queryFn: () => {
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
        limit: "5",
      });
      return apiFetch<SalesBySupplierSummary>(
        `/admin/reports/sales-by-supplier?${params}`,
      );
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const isRefetching = q.isFetching && !q.isLoading;

  const data = (q.data?.topSuppliers ?? []).map((s) => ({
    name:
      s.tradeName.length > 18 ? `${s.tradeName.slice(0, 16)}…` : s.tradeName,
    fullName: s.tradeName,
    total: Math.round(s.totalAmount * 100) / 100,
    orders: s.orderCount,
  }));

  return (
    <section className="surface-card mt-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Top 5 fornecedores
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendas confirmadas no período
            {q.data
              ? ` · ${fmtMoney(q.data.totals.totalAmount)} em ${q.data.totals.orderCount} pedido(s)`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                preset === p
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {PERIOD_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-6 h-64 w-full">
        {q.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="sr-only">Carregando gráfico…</span>
          </div>
        ) : q.error ? (
          <p className="text-sm text-destructive">
            {(q.error as Error).message}
          </p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma venda com fornecedor no período.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
                  }
                />
                <Tooltip
                  formatter={(value) => fmtMoney(Number(value ?? 0))}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | { fullName?: string }
                      | undefined;
                    return row?.fullName ?? "";
                  }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                  }}
                />
                <Bar
                  dataKey="total"
                  name="Vendas"
                  fill="var(--sidebar-primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            {isRefetching ? (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60 backdrop-blur-[1px]"
                aria-busy
                aria-label="Atualizando gráfico"
              >
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
