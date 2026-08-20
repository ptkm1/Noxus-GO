import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, activation } = vi.hoisted(() => ({
  prisma: {
    paymentProviderEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    checkoutIntent: {
      findUnique: vi.fn(),
    },
    organizationSubscription: {
      findFirst: vi.fn(),
    },
  },
  activation: {
    activateOrganizationFromPayment: vi.fn(),
    markIntentCanceled: vi.fn(),
    markIntentExpired: vi.fn(),
    markOrganizationCanceled: vi.fn(),
    markOrganizationPastDue: vi.fn(),
  },
}));

vi.mock("../../../db.js", () => ({ prisma }));

vi.mock("../subscription-activation.js", () => activation);

vi.mock("./asaas-config.js", () => ({
  readAsaasConfig: vi.fn(() => ({
    apiKey: "test-key",
    webhookToken: "whsec_test",
    baseUrl: "https://api-sandbox.asaas.com/v3",
    environment: "sandbox",
    checkoutUrlPrefix: "https://sandbox.asaas.com/checkoutSession/show",
    landingUrl: "http://localhost:3001",
    appUrl: "http://localhost:5173",
    gracePeriodDays: 7,
  })),
}));

import {
  processAsaasWebhook,
  validateAsaasWebhookToken,
} from "./webhook-processor.js";

describe("validateAsaasWebhookToken", () => {
  it("rejeita token ausente ou divergente", () => {
    expect(validateAsaasWebhookToken(undefined)).toBe(false);
    expect(validateAsaasWebhookToken("wrong")).toBe(false);
    expect(validateAsaasWebhookToken("whsec_test")).toBe(true);
  });
});

describe("processAsaasWebhook", () => {
  beforeEach(() => {
    prisma.paymentProviderEvent.findUnique.mockReset();
    prisma.paymentProviderEvent.create.mockReset();
    prisma.paymentProviderEvent.update.mockReset();
    prisma.checkoutIntent.findUnique.mockReset();
    prisma.organizationSubscription.findFirst.mockReset();
    activation.activateOrganizationFromPayment.mockReset();
    activation.markIntentCanceled.mockReset();
    activation.markIntentExpired.mockReset();
    activation.markOrganizationCanceled.mockReset();
    activation.markOrganizationPastDue.mockReset();

    prisma.paymentProviderEvent.findUnique.mockResolvedValue(null);
    prisma.paymentProviderEvent.create.mockImplementation(async ({ data }) => ({
      id: "evt_row",
      ...data,
    }));
    prisma.paymentProviderEvent.update.mockResolvedValue({});
    prisma.checkoutIntent.findUnique.mockResolvedValue(null);
    prisma.organizationSubscription.findFirst.mockResolvedValue(null);
    activation.activateOrganizationFromPayment.mockResolvedValue({
      activated: true,
      alreadyActive: false,
    });
  });

  it("é idempotente para evento já processado", async () => {
    prisma.paymentProviderEvent.findUnique.mockResolvedValue({
      id: "evt_row",
      status: "processed",
    });
    const res = await processAsaasWebhook({
      id: "evt_1",
      event: "PAYMENT_CONFIRMED",
    });
    expect(res.duplicate).toBe(true);
    expect(activation.activateOrganizationFromPayment).not.toHaveBeenCalled();
  });

  it("ativa assinatura em PAYMENT_CONFIRMED", async () => {
    const res = await processAsaasWebhook({
      id: "evt_2",
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_1",
        customer: "cus_1",
        subscription: "sub_1",
        externalReference: "intent_abc",
      },
    });
    expect(res.ok).toBe(true);
    expect(activation.activateOrganizationFromPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        intentId: "intent_abc",
        providerCustomerId: "cus_1",
        providerSubscriptionId: "sub_1",
      }),
    );
  });

  it("ignora evento desconhecido sem falhar", async () => {
    const res = await processAsaasWebhook({
      id: "evt_3",
      event: "PAYMENT_CREATED",
    });
    expect(res.ignored).toBe(true);
    expect(activation.activateOrganizationFromPayment).not.toHaveBeenCalled();
  });
});
