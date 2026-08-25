/** Presets de período para indicadores da home e relatórios. */
export type PeriodPreset =
  | "this_month"
  | "last_month"
  | "last_7_days"
  | "last_90_days";

/** Presets + intervalo personalizado (de–para). */
export type PeriodMode = PeriodPreset | "custom";

/** Máximo de dias civis no modo personalizado (≈ 2 anos). */
export const MAX_CUSTOM_PERIOD_DAYS = 730;

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

export const CUSTOM_PERIOD_LABEL = "Personalizado";

function fmtYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Mesmos presets de `periodRange`, em `YYYY-MM-DD` no calendário local
 * (para pré-preencher o DatePicker do modo personalizado).
 */
export function periodRangeYmd(preset: PeriodPreset): {
  from: string;
  to: string;
} {
  const now = new Date();
  const today = fmtYmdLocal(now);

  if (preset === "last_7_days") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from: fmtYmdLocal(from), to: today };
  }

  if (preset === "last_90_days") {
    const from = new Date(now);
    from.setDate(from.getDate() - 90);
    return { from: fmtYmdLocal(from), to: today };
  }

  if (preset === "last_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmtYmdLocal(from), to: fmtYmdLocal(end) };
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: fmtYmdLocal(from), to: today };
}

/** Converte `YYYY-MM-DD` local em início/fim do dia (ISO). */
export function ymdToIsoRange(
  fromYmd: string,
  toYmd: string,
): { from: string; to: string } {
  return {
    from: new Date(`${fromYmd}T00:00:00`).toISOString(),
    to: new Date(`${toYmd}T23:59:59.999`).toISOString(),
  };
}

/**
 * Valida intervalo personalizado (`YYYY-MM-DD`).
 * @returns mensagem de erro ou `null` se válido.
 */
export function validateCustomPeriod(
  fromYmd: string,
  toYmd: string,
): string | null {
  if (!fromYmd.trim() || !toYmd.trim()) {
    return "Informe a data inicial e a final.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    return "Datas inválidas.";
  }
  const from = new Date(`${fromYmd}T00:00:00`);
  const to = new Date(`${toYmd}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return "Datas inválidas.";
  }
  if (to < from) {
    return "A data final deve ser maior ou igual à inicial.";
  }
  const days =
    Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days > MAX_CUSTOM_PERIOD_DAYS) {
    return `Período máximo de ${MAX_CUSTOM_PERIOD_DAYS} dias (cerca de 2 anos).`;
  }
  return null;
}
