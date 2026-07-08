/** Presets de período para relatório Top fornecedores. */
export type PeriodPreset =
  | "this_month"
  | "last_month"
  | "last_7_days"
  | "last_90_days";

export function periodRange(preset: PeriodPreset): {
  from: string;
  to: string;
} {
  const now = new Date();
  const to = now.toISOString();

  if (preset === "last_7_days") {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 7);
    from.setUTCHours(0, 0, 0, 0);
    return { from: from.toISOString(), to };
  }

  if (preset === "last_90_days") {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 90);
    from.setUTCHours(0, 0, 0, 0);
    return { from: from.toISOString(), to };
  }

  if (preset === "last_month") {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    return { from: from.toISOString(), to: end.toISOString() };
  }

  // this_month
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  return { from: from.toISOString(), to };
}

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  this_month: "Este mês",
  last_month: "Mês passado",
  last_7_days: "Últimos 7 dias",
  last_90_days: "Últimos 90 dias",
};
