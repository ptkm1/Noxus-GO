import { apiFetch } from "@/lib/api";
import {
  PERIOD_PRESET_LABELS,
  periodRange,
  type PeriodPreset,
} from "@/lib/period-presets";
import { cn } from "@/lib/utils";
import {
  HOME_INDICATOR_SHORT_LABELS,
  type HomeIndicatorKey,
} from "@pedidos/shared";
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

export type HomeIndicatorSummary = {
  key: HomeIndicatorKey;
  period: { from: string; to: string };
  metric: "sales" | "profit";
  totals: {
    totalAmount: number;
    orderCount: number;
    linesMissingCost?: number;
  };
  rows: Array<{
    id: string;
    label: string;
    value: number;
    secondary?: number;
    orderCount?: number;
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

const EMPTY_HINT: Record<HomeIndicatorKey, string> = {
  sales_by_supplier: "Nenhuma venda com fornecedor no período.",
  sales_by_seller: "Nenhuma venda por vendedor no período.",
  profit_by_city: "Nenhuma rentabilidade por cidade no período.",
  profit_by_product: "Nenhum produto com rentabilidade no período.",
  profit_by_customer: "Nenhum cliente com rentabilidade no período.",
};

type Props = {
  indicatorKey: HomeIndicatorKey;
  /** Layout compacto para grade lado a lado. */
  compact?: boolean;
};

export function HomeIndicatorWidget({ indicatorKey, compact = false }: Props) {
  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const range = useMemo(() => periodRange(preset), [preset]);

  const q = useQuery({
    queryKey: ["admin", "home-indicator", indicatorKey, range.from, range.to],
    queryFn: () => {
      const params = new URLSearchParams({
        key: indicatorKey,
        from: range.from,
        to: range.to,
        limit: "5",
      });
      return apiFetch<HomeIndicatorSummary>(
        `/admin/reports/home-indicator?${params}`,
      );
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const isRefetching = q.isFetching && !q.isLoading;
  const isProfit =
    (q.data?.metric ?? indicatorKey.startsWith("profit_")) === "profit";
  const valueLabel = isProfit ? "Margem" : "Vendas";

  const data = (q.data?.rows ?? []).map((s) => ({
    name: s.label.length > 18 ? `${s.label.slice(0, 16)}…` : s.label,
    fullName: s.label,
    total: Math.round(s.value * 100) / 100,
    orders: s.orderCount ?? 0,
    marginPct: s.secondary,
  }));

  const subtitleParts: string[] = [];
  if (q.data) {
    subtitleParts.push(
      `${fmtMoney(q.data.totals.totalAmount)} em ${q.data.totals.orderCount} pedido(s)`,
    );
    if (
      isProfit &&
      q.data.totals.linesMissingCost != null &&
      q.data.totals.linesMissingCost > 0
    ) {
      subtitleParts.push(
        `${q.data.totals.linesMissingCost} linha(s) sem custo cadastrado`,
      );
    }
  }

  return (
    <section
      className={cn(
        "surface-card h-full p-4",
        compact ? "sm:p-4" : "mt-6 sm:p-6",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3",
          !compact && "sm:flex-row sm:items-start sm:justify-between",
        )}
      >
        <div className="min-w-0">
          <h2
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-sm leading-snug" : "text-lg",
            )}
          >
            {HOME_INDICATOR_SHORT_LABELS[indicatorKey]}
          </h2>
          <p
            className={cn(
              "mt-1 text-muted-foreground",
              compact ? "line-clamp-2 text-xs" : "text-sm",
            )}
          >
            {compact
              ? (subtitleParts[0] ??
                (isProfit ? "Margem no período" : "Vendas no período"))
              : `${
                  isProfit
                    ? "Margem (receita − custo do produto) no período"
                    : "Vendas confirmadas no período"
                }${subtitleParts.length > 0 ? ` · ${subtitleParts.join(" · ")}` : ""}`}
          </p>
        </div>
        <div className={cn("flex flex-wrap gap-1.5", !compact && "gap-2")}>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={cn(
                "rounded-md font-medium transition-colors",
                compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs",
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

      <div
        className={cn("relative w-full", compact ? "mt-3 h-48" : "mt-6 h-64")}
      >
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
            {EMPTY_HINT[indicatorKey]}
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
                  tick={{ fontSize: compact ? 10 : 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: compact ? 10 : 12 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v: number) =>
                    v >= 1000 || v <= -1000
                      ? `${(v / 1000).toFixed(1)}k`
                      : String(v)
                  }
                />
                <Tooltip
                  formatter={(value, _name, item) => {
                    const row = item?.payload as
                      | { marginPct?: number }
                      | undefined;
                    const money = fmtMoney(Number(value ?? 0));
                    if (isProfit && row?.marginPct != null) {
                      return [
                        `${money} (${row.marginPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`,
                        valueLabel,
                      ];
                    }
                    return [money, valueLabel];
                  }}
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
                  name={valueLabel}
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
