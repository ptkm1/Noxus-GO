import type { ApexOptions } from "apexcharts";
import { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import "apexcharts/dist/apexcharts.css";

export type SalesDailyPoint = {
  date: string;
  orderCount: number;
  totalAmount: number;
};

type SalesMonthAreaChartProps = {
  daily: SalesDailyPoint[];
  from: string;
  to: string;
  isLoading?: boolean;
};

type ThemeColors = {
  primary: string;
  muted: string;
  foreground: string;
  border: string;
  isDark: boolean;
};

function readThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  return {
    primary: style.getPropertyValue("--primary").trim() || "#02445c",
    muted: style.getPropertyValue("--muted-foreground").trim() || "#64748b",
    foreground: style.getPropertyValue("--foreground").trim() || "#111827",
    border: style.getPropertyValue("--border").trim() || "#e2e8f0",
    isDark: document.documentElement.classList.contains("dark"),
  };
}

function fillDailySeries(
  daily: SalesDailyPoint[],
  fromIso: string,
  toIso: string,
): [number, number][] {
  const byDate = new Map(daily.map((d) => [d.date, d.totalAmount]));
  const start = new Date(fromIso);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(toIso);
  end.setUTCHours(0, 0, 0, 0);

  const points: [number, number][] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    points.push([cursor.getTime(), byDate.get(key) ?? 0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/**
 * Area chart datetime (estilo ApexCharts area-datetime) — faturamento diário
 * de pedidos confirmados no período.
 */
export function SalesMonthAreaChart({
  daily,
  from,
  to,
  isLoading = false,
}: Readonly<SalesMonthAreaChartProps>) {
  const [colors, setColors] = useState<ThemeColors>(() =>
    typeof document !== "undefined"
      ? readThemeColors()
      : {
          primary: "#02445c",
          muted: "#64748b",
          foreground: "#111827",
          border: "#e2e8f0",
          isDark: false,
        },
  );

  useEffect(() => {
    const sync = () => setColors(readThemeColors());
    sync();
    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const seriesData = useMemo(
    () => fillDailySeries(daily, from, to),
    [daily, from, to],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: "home-sales-area-datetime",
        type: "area",
        fontFamily: "Sora, system-ui, sans-serif",
        background: "transparent",
        toolbar: { show: true, tools: { download: false } },
        zoom: {
          enabled: true,
          autoScaleYaxis: true,
        },
      },
      colors: [colors.primary],
      dataLabels: { enabled: false },
      markers: {
        size: 0,
        hover: { size: 5 },
      },
      stroke: {
        curve: "smooth",
        width: 2,
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.55,
          opacityTo: 0.1,
          stops: [0, 100],
        },
      },
      grid: {
        borderColor: colors.border,
        strokeDashArray: 3,
      },
      xaxis: {
        type: "datetime",
        min: new Date(from).setUTCHours(0, 0, 0, 0),
        max: new Date(to).setUTCHours(0, 0, 0, 0),
        tickAmount: 6,
        labels: {
          style: { colors: colors.muted, fontSize: "11px" },
          datetimeUTC: true,
        },
        axisBorder: { color: colors.border },
        axisTicks: { color: colors.border },
      },
      yaxis: {
        labels: {
          style: { colors: colors.muted, fontSize: "11px" },
          formatter: (val) => fmtMoney(val),
        },
      },
      tooltip: {
        theme: colors.isDark ? "dark" : "light",
        x: { format: "dd MMM yyyy" },
        y: {
          formatter: (val) =>
            val.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
        },
      },
      title: {
        text: "Vendas do mês",
        align: "left",
        style: {
          fontSize: "14px",
          fontWeight: 600,
          color: colors.foreground,
        },
      },
      legend: { show: false },
    }),
    [colors, from, to],
  );

  const series = useMemo(
    () => [{ name: "Faturamento", data: seriesData }],
    [seriesData],
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <p className="text-sm text-muted-foreground">Carregando gráfico…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-3 sm:p-4">
      <Chart
        type="area"
        height={320}
        series={series}
        options={options}
      />
    </div>
  );
}
