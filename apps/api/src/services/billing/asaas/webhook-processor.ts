import type { Prisma } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "../../../db.js";
import {
  activateOrganizationFromPayment,
  markIntentCanceled,
  markIntentExpired,
  markOrganizationCanceled,
  markOrganizationPastDue,
} from "../subscription-activation.js";
import { readAsaasConfig } from "./asaas-config.js";
import { mapAsaasPaymentEventToInternalStatus } from "./map-status.js";

function safeEqualToken(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function validateAsaasWebhookToken(
  headerValue: string | string[] | undefined,
): boolean {
  const cfg = readAsaasConfig();
  if (!cfg?.webhookToken) return false;
  const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!token) return false;
  return safeEqualToken(token, cfg.webhookToken);
}

type AsaasWebhookBody = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    customer?: string;
    subscription?: string;
    externalReference?: string;
    status?: string;
  };
  subscription?: {
    id?: string;
    customer?: string;
    externalReference?: string;
    status?: string;
  };
  checkout?: {
    id?: string;
    externalReference?: string;
  };
};

function sanitizePayload(body: AsaasWebhookBody): Record<string, unknown> {
  return {
    event: body.event ?? null,
    paymentId: body.payment?.id ?? null,
    subscriptionId: body.subscription?.id ?? null,
    checkoutId: body.checkout?.id ?? null,
    externalReference:
      body.payment?.externalReference ||
      body.subscription?.externalReference ||
      body.checkout?.externalReference ||
      null,
  };
}

export async function processAsaasWebhook(
  body: AsaasWebhookBody,
): Promise<{ ok: true; duplicate?: boolean; ignored?: boolean }> {
  const eventType = body.event || "UNKNOWN";
  const providerEventId =
    body.id ||
    `${eventType}:${body.payment?.id || body.checkout?.id || Date.now()}`;

  const existing = await prisma.paymentProviderEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: "asaas",
        providerEventId,
      },
    },
  });
  if (existing?.status === "processed" || existing?.status === "ignored") {
    return { ok: true, duplicate: true };
  }

  const eventRow =
    existing ||
    (await prisma.paymentProviderEvent.create({
      data: {
        provider: "asaas",
        providerEventId,
        eventType,
        status: "received",
        payloadSanitized: sanitizePayload(body) as Prisma.InputJsonValue,
      },
    }));

  const effect = mapAsaasPaymentEventToInternalStatus(eventType);
  const intentId =
    body.payment?.externalReference ||
    body.subscription?.externalReference ||
    body.checkout?.externalReference ||
    null;
  const providerCustomerId =
    body.payment?.customer || body.subscription?.customer || null;

  let organizationId: string | null = null;
  if (!intentId && providerCustomerId) {
    const sub = await prisma.organizationSubscription.findFirst({
      where: { providerCustomerId },
      select: { organizationId: true },
    });
    organizationId = sub?.organizationId ?? null;
  }

  try {
    if (effect === "activate") {
      await activateOrganizationFromPayment({
        intentId,
        organizationId,
        providerCustomerId,
        providerSubscriptionId:
          body.payment?.subscription || body.subscription?.id,
        providerCheckoutId: body.checkout?.id,
      });
    } else if (effect === "past_due") {
      const intent = intentId
        ? await prisma.checkoutIntent.findUnique({ where: { id: intentId } })
        : null;
      const orgId = intent?.organizationId || organizationId;
      if (orgId) await markOrganizationPastDue(orgId);
    } else if (effect === "canceled") {
      const intent = intentId
        ? await prisma.checkoutIntent.findUnique({ where: { id: intentId } })
        : null;
      if (intentId) await markIntentCanceled(intentId);
      if (intent?.organizationId && intent.status === "COMPLETED") {
        await markOrganizationCanceled(intent.organizationId);
      }
    } else if (effect === "expired") {
      if (intentId) await markIntentExpired(intentId);
    }

    await prisma.paymentProviderEvent.update({
      where: { id: eventRow.id },
      data: {
        status: effect === "ignore" ? "ignored" : "processed",
        processedAt: new Date(),
      },
    });

    return {
      ok: true,
      ignored: effect === "ignore",
    };
  } catch (err) {
    await prisma.paymentProviderEvent.update({
      where: { id: eventRow.id },
      data: {
        status: "failed",
        errorMessage:
          err instanceof Error ? err.message.slice(0, 400) : "webhook_failed",
      },
    });
    throw err;
  }
}
