import { prisma } from "../db.js";
import {
  consultOutboundInvoiceSituation,
  transmitOutboundInvoice,
} from "./fiscal-outbound.js";

const MAX_ATTEMPTS = 5;

function backoffMs(attempts: number): number {
  // 30s, 1m, 2m, 5m, 10m
  const table = [30_000, 60_000, 120_000, 300_000, 600_000];
  return table[Math.min(attempts, table.length - 1)] ?? 600_000;
}

/** Enfileira transmissão assíncrona (idempotente se já houver job aberto). */
export async function enqueueFiscalTransmit(
  organizationId: string,
  invoiceId: string,
) {
  const invoice = await prisma.fiscalInvoice.findFirst({
    where: { id: invoiceId, organizationId, direction: "OUTBOUND" },
  });
  if (!invoice) return { ok: false as const, error: "Nota não encontrada" };
  if (
    invoice.status !== "DRAFT" &&
    invoice.status !== "REJECTED" &&
    invoice.status !== "TRANSMITTED"
  ) {
    return {
      ok: false as const,
      error: "Status inválido para enfileirar transmissão",
    };
  }

  const existing = await prisma.fiscalTransmitJob.findFirst({
    where: {
      invoiceId,
      status: { in: ["PENDING", "RUNNING"] },
    },
  });
  if (existing)
    return { ok: true as const, job: existing, alreadyQueued: true };

  const job = await prisma.fiscalTransmitJob.create({
    data: {
      organizationId,
      invoiceId,
      status: "PENDING",
      nextRunAt: new Date(),
    },
  });
  return { ok: true as const, job, alreadyQueued: false };
}

export async function requeueFiscalTransmit(
  organizationId: string,
  invoiceId: string,
) {
  const failed = await prisma.fiscalTransmitJob.findFirst({
    where: { organizationId, invoiceId, status: "FAILED" },
    orderBy: { createdAt: "desc" },
  });
  if (failed) {
    const job = await prisma.fiscalTransmitJob.update({
      where: { id: failed.id },
      data: {
        status: "PENDING",
        nextRunAt: new Date(),
        lastError: null,
        attempts: 0,
      },
    });
    return { ok: true as const, job };
  }
  return enqueueFiscalTransmit(organizationId, invoiceId);
}

async function processOneJob(jobId: string) {
  const job = await prisma.fiscalTransmitJob.findUnique({
    where: { id: jobId },
    include: { invoice: true },
  });
  if (!job || (job.status !== "PENDING" && job.status !== "RUNNING")) return;

  await prisma.fiscalTransmitJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", attempts: job.attempts + 1 },
  });

  try {
    // Poll de nota já transmitida (cStat 103)
    if (job.invoice.status === "TRANSMITTED" && job.invoice.accessKey) {
      const consult = await consultOutboundInvoiceSituation(
        job.organizationId,
        job.invoiceId,
      );
      const refreshed = await prisma.fiscalInvoice.findUnique({
        where: { id: job.invoiceId },
      });
      if (refreshed?.status === "AUTHORIZED") {
        await prisma.fiscalTransmitJob.update({
          where: { id: job.id },
          data: { status: "SUCCEEDED", lastError: null },
        });
        return;
      }
      if (!consult.ok) {
        throw new Error(consult.error ?? "Falha na consulta de situação");
      }
      // Ainda pendente — reagenda
      await prisma.fiscalTransmitJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          nextRunAt: new Date(Date.now() + backoffMs(job.attempts)),
          lastError: "Aguardando autorização SEFAZ (poll)",
        },
      });
      return;
    }

    const result = await transmitOutboundInvoice(
      job.organizationId,
      job.invoiceId,
    );

    if (result.ok && "pending" in result && result.pending) {
      await prisma.fiscalTransmitJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          sefazReceipt: result.sefazReceipt,
          nextRunAt: new Date(Date.now() + backoffMs(job.attempts)),
          lastError: null,
        },
      });
      return;
    }

    if (result.ok) {
      await prisma.fiscalTransmitJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", lastError: null },
      });
      return;
    }

    const attempts = job.attempts + 1;
    const networkish = /timeout|ECONN|comunicação|SEFAZ HTTP|network/i.test(
      result.error ?? "",
    );
    if (networkish && attempts < MAX_ATTEMPTS) {
      await prisma.fiscalTransmitJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          nextRunAt: new Date(Date.now() + backoffMs(attempts)),
          lastError: result.error ?? "Erro de rede",
        },
      });
      return;
    }

    await prisma.fiscalTransmitJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        lastError: result.error ?? "Falha na transmissão",
      },
    });
  } catch (e) {
    const attempts = job.attempts + 1;
    const msg = e instanceof Error ? e.message : "Erro no worker fiscal";
    if (attempts < MAX_ATTEMPTS) {
      await prisma.fiscalTransmitJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          nextRunAt: new Date(Date.now() + backoffMs(attempts)),
          lastError: msg,
        },
      });
    } else {
      await prisma.fiscalTransmitJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: msg },
      });
    }
  }
}

/** Processa lote de jobs pendentes (cron /jobs/fiscal-transmit). */
export async function runFiscalTransmitJobs(opts?: {
  organizationId?: string;
  limit?: number;
}) {
  const limit = opts?.limit ?? 10;
  const now = new Date();
  const jobs = await prisma.fiscalTransmitJob.findMany({
    where: {
      status: "PENDING",
      nextRunAt: { lte: now },
      ...(opts?.organizationId ? { organizationId: opts.organizationId } : {}),
    },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  for (const job of jobs) {
    await processOneJob(job.id);
    processed += 1;
    const refreshed = await prisma.fiscalTransmitJob.findUnique({
      where: { id: job.id },
    });
    if (refreshed?.status === "SUCCEEDED") succeeded += 1;
    if (refreshed?.status === "FAILED") failed += 1;
  }

  return { processed, succeeded, failed, claimed: jobs.length };
}

export async function latestTransmitJobForInvoice(invoiceId: string) {
  return prisma.fiscalTransmitJob.findFirst({
    where: { invoiceId },
    orderBy: { createdAt: "desc" },
  });
}
