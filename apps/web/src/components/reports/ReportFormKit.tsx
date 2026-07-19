import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function ReportBreadcrumb({ current }: { current: string }) {
  return (
    <nav className="text-sm text-muted-foreground">
      <Link to="/" className="hover:text-foreground">
        Início
      </Link>
      <span className="mx-1.5">›</span>
      <Link to="/relatorios" className="hover:text-foreground">
        Relatórios
      </Link>
      <span className="mx-1.5">›</span>
      <span className="text-foreground">{current}</span>
    </nav>
  );
}

export function ReportFormLayout({
  title,
  children,
  onGenerate,
  generating,
  onClear,
  generateDisabled,
  className,
}: {
  title: string;
  children: ReactNode;
  onGenerate: () => void;
  generating?: boolean;
  onClear: () => void;
  generateDisabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-3xl space-y-8", className)}>
      <div className="space-y-2">
        <ReportBreadcrumb current={title} />
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      </div>

      <div className="space-y-5">{children}</div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Limpar filtros
        </button>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/relatorios">Voltar</Link>
          </Button>
          <Button
            type="button"
            disabled={generateDisabled || generating}
            onClick={onGenerate}
          >
            {generating ? "Gerando…" : "Gerar relatório"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReportField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-2 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4",
        className,
      )}
    >
      <label className="text-sm font-medium text-foreground sm:text-right">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

/** Atalhos de período para inputs type=date (YYYY-MM-DD). */
export function datePresets(): Array<{
  label: string;
  from: string;
  to: string;
}> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(12, 0, 0, 0);
    return x;
  };

  const yesterday = startOfDay(new Date(today));
  yesterday.setDate(yesterday.getDate() - 1);

  const weekStart = startOfDay(new Date(today));
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diff);

  const monthStart = startOfDay(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const lastMonthStart = startOfDay(
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
  );
  const lastMonthEnd = startOfDay(
    new Date(today.getFullYear(), today.getMonth(), 0),
  );

  const last30 = startOfDay(new Date(today));
  last30.setDate(last30.getDate() - 29);

  return [
    { label: "Hoje", from: fmt(today), to: fmt(today) },
    { label: "Ontem", from: fmt(yesterday), to: fmt(yesterday) },
    { label: "Esta semana", from: fmt(weekStart), to: fmt(today) },
    { label: "Este mês", from: fmt(monthStart), to: fmt(today) },
    { label: "Mês passado", from: fmt(lastMonthStart), to: fmt(lastMonthEnd) },
    { label: "Últimos 30 dias", from: fmt(last30), to: fmt(today) },
  ];
}

export function DateRangeField({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker
          value={from}
          onChange={(v) => onChange(v, to)}
          placeholder="De"
          className="w-[11.5rem]"
        />
        <span className="text-muted-foreground">até</span>
        <DatePicker
          value={to}
          onChange={(v) => onChange(from, v)}
          placeholder="Até"
          className="w-[11.5rem]"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {datePresets().map((p) => (
          <button
            key={p.label}
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onChange(p.from, p.to)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function toIsoRange(
  from: string,
  to: string,
): { from?: string; to?: string } {
  const out: { from?: string; to?: string } = {};
  if (from) {
    const d = new Date(`${from}T00:00:00`);
    out.from = d.toISOString();
  }
  if (to) {
    const d = new Date(`${to}T23:59:59.999`);
    out.to = d.toISOString();
  }
  return out;
}
