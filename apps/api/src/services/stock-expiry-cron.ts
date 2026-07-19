import { runStockExpiryAlerts } from "../services/stock-expiry-alerts.js";

/**
 * Agenda execução diária às 08:00 no fuso indicado (padrão America/Sao_Paulo).
 * Ativado com STOCK_EXPIRY_CRON=1.
 */
export function scheduleStockExpiryCron(log?: {
  info: (o: unknown, msg?: string) => void;
  error: (o: unknown, msg?: string) => void;
}) {
  if (process.env.STOCK_EXPIRY_CRON?.trim() !== "1") return;

  const timeZone =
    process.env.STOCK_EXPIRY_CRON_TZ?.trim() || "America/Sao_Paulo";
  const hour = 8;
  let lastRunKey = "";

  const tick = async () => {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const get = (type: string) =>
        parts.find((p) => p.type === type)?.value ?? "";
      const y = get("year");
      const m = get("month");
      const d = get("day");
      const h = Number(get("hour"));
      const dayKey = `${y}-${m}-${d}`;
      if (h !== hour || lastRunKey === dayKey) return;
      lastRunKey = dayKey;
      log?.info({ timeZone, dayKey }, "[stock-expiry] iniciando job agendado");
      const result = await runStockExpiryAlerts();
      log?.info(result, "[stock-expiry] job concluído");
    } catch (err) {
      log?.error(err, "[stock-expiry] falha no job agendado");
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), 60_000);
  if (typeof timer.unref === "function") timer.unref();
  log?.info(
    { timeZone, hour },
    "[stock-expiry] cron diário ativo (STOCK_EXPIRY_CRON=1)",
  );
}
