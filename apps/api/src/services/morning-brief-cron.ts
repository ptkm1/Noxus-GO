import { runCertificateExpiryAlerts } from "./cert-expiry-alerts.js";
import { runMorningBriefJob } from "./morning-brief.js";

/**
 * Agenda geração do resumo matinal às 07:00 America/Sao_Paulo.
 * Ativado com MORNING_BRIEF_CRON=1.
 * Também dispara alertas de validade do certificado A1 (60/30/15/7/0).
 */
export function scheduleMorningBriefCron(log?: {
  info: (o: unknown, msg?: string) => void;
  error: (o: unknown, msg?: string) => void;
}) {
  if (process.env.MORNING_BRIEF_CRON?.trim() !== "1") return;

  const timeZone =
    process.env.MORNING_BRIEF_CRON_TZ?.trim() || "America/Sao_Paulo";
  const hour = Number(process.env.MORNING_BRIEF_CRON_HOUR?.trim() || "7");
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
      log?.info({ timeZone, dayKey }, "[morning-brief] iniciando job agendado");
      const result = await runMorningBriefJob({ notify: true });
      log?.info(result, "[morning-brief] job concluído");
      try {
        const cert = await runCertificateExpiryAlerts();
        log?.info(cert, "[cert-expiry] job concluído");
      } catch (certErr) {
        log?.error(certErr, "[cert-expiry] falha no job agendado");
      }
    } catch (err) {
      log?.error(err, "[morning-brief] falha no job agendado");
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), 60_000);
  if (typeof timer.unref === "function") timer.unref();
  log?.info(
    { timeZone, hour },
    "[morning-brief] cron diário ativo (MORNING_BRIEF_CRON=1)",
  );
}
