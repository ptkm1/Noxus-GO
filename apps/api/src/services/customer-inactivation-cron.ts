import { runCustomerInactivation } from "./customer-status.js";

/**
 * Agenda execução diária às 06:30 no fuso indicado (padrão America/Sao_Paulo).
 * Ativado com CUSTOMER_INACTIVATION_CRON=1.
 */
export function scheduleCustomerInactivationCron(log?: {
  info: (o: unknown, msg?: string) => void;
  error: (o: unknown, msg?: string) => void;
}) {
  if (process.env.CUSTOMER_INACTIVATION_CRON?.trim() !== "1") return;

  const timeZone =
    process.env.CUSTOMER_INACTIVATION_CRON_TZ?.trim() || "America/Sao_Paulo";
  const hour = 6;
  const minute = 30;
  let lastRunKey = "";

  const tick = async () => {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const get = (type: string) =>
        parts.find((p) => p.type === type)?.value ?? "";
      const y = get("year");
      const m = get("month");
      const d = get("day");
      const h = Number(get("hour"));
      const min = Number(get("minute"));
      const dayKey = `${y}-${m}-${d}`;
      if (h !== hour || min < minute || lastRunKey === dayKey) return;
      lastRunKey = dayKey;
      log?.info(
        { timeZone, dayKey },
        "[customer-inactivation] iniciando job agendado",
      );
      const result = await runCustomerInactivation();
      log?.info(result, "[customer-inactivation] job concluído");
    } catch (err) {
      log?.error(err, "[customer-inactivation] falha no job agendado");
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), 60_000);
  if (typeof timer.unref === "function") timer.unref();
  log?.info(
    { timeZone, hour, minute },
    "[customer-inactivation] cron diário ativo (CUSTOMER_INACTIVATION_CRON=1)",
  );
}
