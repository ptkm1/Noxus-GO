import type { BankingProviderKind, Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { decryptBankingSecret } from "./credentials.js";
import { createBankingProvider } from "./resolve-banking-provider.js";
import { applyReceivableStatusUpdate } from "./receivable-service.js";

export function parseProviderParam(
  raw: string,
): BankingProviderKind | null {
  const u = raw.trim().toUpperCase();
  if (u === "ITAU" || u === "BB" || u === "SANTANDER") return u;
  return null;
}

/**
 * Processa webhook bancário de forma idempotente (provider + providerEventId).
 * Autenticação: token/secret por conexão (ou env global do provedor).
 */
export async function processBankingWebhook(input: {
  provider: BankingProviderKind;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody?: string;
  /** connectionId opcional na URL/query para multi-tenant. */
  connectionId?: string | null;
}): Promise<{ ok: true; duplicate?: boolean; processed: number; ignored?: boolean }> {
  const connections = input.connectionId
    ? await prisma.bankConnection.findMany({
        where: {
          id: input.connectionId,
          provider: input.provider,
          status: { in: ["ACTIVE", "PENDING_SETUP", "ERROR"] },
        },
      })
    : await prisma.bankConnection.findMany({
        where: {
          provider: input.provider,
          status: { in: ["ACTIVE", "PENDING_SETUP", "ERROR"] },
        },
        take: 50,
      });

  if (!connections.length) {
    return { ok: true, processed: 0, ignored: true };
  }

  // Verifica com a primeira conexão que tiver secret válido (ou env).
  let verified = false;
  let connection = connections[0]!;
  for (const c of connections) {
    const provider = createBankingProvider(c);
    let expectedSecret: string | null = null;
    if (c.webhookSecretEncrypted) {
      try {
        expectedSecret = decryptBankingSecret(c.webhookSecretEncrypted);
      } catch {
        expectedSecret = null;
      }
    }
    expectedSecret =
      expectedSecret ||
      process.env[`BANKING_${c.provider}_WEBHOOK_TOKEN`]?.trim() ||
      null;
    if (
      provider.verifyWebhook({
        headers: input.headers,
        rawBody: input.rawBody ?? JSON.stringify(input.body ?? {}),
        expectedSecret,
      })
    ) {
      verified = true;
      connection = c;
      break;
    }
  }

  if (!verified) {
    const err = new Error("Webhook bancário não autorizado");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }

  const provider = createBankingProvider(connection);
  const events = provider.parseWebhook({
    headers: input.headers,
    body: input.body,
  });

  let processed = 0;
  for (const ev of events) {
    const existing = await prisma.bankingWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: input.provider,
          providerEventId: ev.providerEventId,
        },
      },
    });
    if (existing?.status === "processed" || existing?.status === "ignored") {
      continue;
    }

    const eventRow =
      existing ||
      (await prisma.bankingWebhookEvent.create({
        data: {
          provider: input.provider,
          providerEventId: ev.providerEventId,
          eventType: ev.eventType,
          status: "received",
          organizationId: connection.organizationId,
          bankConnectionId: connection.id,
          payloadSanitized: ev.sanitized as Prisma.InputJsonValue,
        },
      }));

    try {
      if (!ev.status) {
        await prisma.bankingWebhookEvent.update({
          where: { id: eventRow.id },
          data: { status: "ignored", processedAt: new Date() },
        });
        continue;
      }

      const updated = await applyReceivableStatusUpdate({
        organizationId: connection.organizationId,
        bankConnectionId: connection.id,
        externalId: ev.externalId,
        nossoNumero: ev.nossoNumero,
        status: ev.status,
        externalStatus: ev.externalStatus,
        paidAmount: ev.paidAmount,
        paidAt: ev.paidAt,
      });

      await prisma.bankingWebhookEvent.update({
        where: { id: eventRow.id },
        data: {
          status: updated ? "processed" : "ignored",
          processedAt: new Date(),
          receivableId: updated?.id ?? null,
        },
      });
      if (updated) processed++;
    } catch (err) {
      await prisma.bankingWebhookEvent.update({
        where: { id: eventRow.id },
        data: {
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "erro",
        },
      });
      throw err;
    }
  }

  await prisma.bankConnection.update({
    where: { id: connection.id },
    data: { lastSyncAt: new Date(), lastError: null },
  });

  return {
    ok: true,
    processed,
    duplicate: processed === 0 && events.length > 0,
  };
}
