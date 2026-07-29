import { runFiscalTransmitJobs } from "./fiscal-transmit-queue.js";

/**
 * Processa a fila de transmissão NF-e a cada minuto.
 * Ativado com FISCAL_TRANSMIT_CRON=1.
 */
export function scheduleFiscalTransmitCron(log?: {
  info: (o: unknown, msg?: string) => void;
  error: (o: unknown, msg?: string) => void;
}) {
  if (process.env.FISCAL_TRANSMIT_CRON?.trim() !== "1") return;

  const tick = async () => {
    try {
      const result = await runFiscalTransmitJobs({ limit: 10 });
      if (result.claimed > 0) {
        log?.info(result, "[fiscal-transmit] jobs processados");
      }
    } catch (err) {
      log?.error(err, "[fiscal-transmit] falha no job agendado");
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), 60_000);
  if (typeof timer.unref === "function") timer.unref();
  log?.info({}, "[fiscal-transmit] cron ativo (FISCAL_TRANSMIT_CRON=1)");
}
