import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_TRIAL_DAYS } from "@pedidos/shared";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";
import { TRIAL_EXPIRED_MESSAGE, syncOrgAccessFromSubscription } from "../services/billing/subscription-access.js";

const hasDb = Boolean(
  process.env.DATABASE_URL?.trim() && process.env.JWT_SECRET?.trim(),
);

const CNPJ_WEIGHTS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const CNPJ_WEIGHTS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

function cnpjCheckDigit(digits: string, weights: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += Number(digits[i]) * weights[i]!;
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function uniqueValidCnpj(seed: string): string {
  const raw = seed.replace(/\D/g, "").padStart(12, "1").slice(0, 12);
  const base = /^(\d)\1{11}$/.test(raw) ? "123456780001" : raw;
  const dv1 = cnpjCheckDigit(base, CNPJ_WEIGHTS_DV1);
  const dv2 = cnpjCheckDigit(`${base}${dv1}`, CNPJ_WEIGHTS_DV2);
  return `${base}${dv1}${dv2}`;
}

describe.skipIf(!hasDb)("POST /auth/register — trial 7 dias", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const orgIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
  }, 60_000);

  afterAll(async () => {
    if (orgIds.length) {
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    if (app) await app.close();
  });

  it("cria TRIAL de 7 dias, ACTIVE e canUseApp sem exigir pagamento", async () => {
    const email = `trial-a-${stamp}@trial.test`;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        organizationName: `Trial A ${stamp}`,
        name: "Admin Trial",
        email,
        password: "senha123",
        cnpj: uniqueValidCnpj(`1${stamp}`),
        planId: "pro",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      requiresPayment: boolean;
      intentId: string | null;
      checkoutUrl: string | null;
      user: {
        organizationId: string;
        canUseApp: boolean;
        accessStatus: string;
        subscription: {
          status: string;
          currentPeriodEnd: string | null;
          planId: string;
        };
      };
    };
    orgIds.push(body.user.organizationId);

    expect(body.requiresPayment).toBe(false);
    expect(body.intentId).toBeNull();
    expect(body.checkoutUrl).toBeNull();
    expect(body.user.canUseApp).toBe(true);
    expect(body.user.accessStatus).toBe("ACTIVE");
    expect(body.user.subscription.status).toBe("TRIAL");
    expect(body.user.subscription.planId).toBe("pro");

    const end = body.user.subscription.currentPeriodEnd
      ? new Date(body.user.subscription.currentPeriodEnd)
      : null;
    expect(end).not.toBeNull();
    const deltaMs = end!.getTime() - Date.now();
    const day = 24 * 60 * 60 * 1000;
    expect(deltaMs).toBeGreaterThan((DEFAULT_TRIAL_DAYS - 0.5) * day);
    expect(deltaMs).toBeLessThan((DEFAULT_TRIAL_DAYS + 0.5) * day);

    const stored = await prisma.organization.findUnique({
      where: { id: body.user.organizationId },
      select: {
        accessStatus: true,
        subscription: {
          select: { status: true, currentPeriodEnd: true, provider: true },
        },
      },
    });
    expect(stored?.accessStatus).toBe("ACTIVE");
    expect(stored?.subscription?.status).toBe("TRIAL");
    expect(stored?.subscription?.provider).toBe("none");
  });

  it("segunda organização também ganha trial próprio", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        organizationName: `Trial B ${stamp}`,
        name: "Admin B",
        email: `trial-b-${stamp}@trial.test`,
        password: "senha123",
        cnpj: uniqueValidCnpj(`2${stamp}`),
        planId: "start",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      user: { organizationId: string; canUseApp: boolean };
    };
    orgIds.push(body.user.organizationId);
    expect(body.user.canUseApp).toBe(true);
  });

  it("org com trial expirado não canUse e vai para PENDING_PAYMENT", async () => {
    const org = await prisma.organization.create({
      data: {
        name: `Trial expired ${stamp}`,
        displayName: `Trial expired ${stamp}`,
        accessStatus: "ACTIVE",
      },
    });
    orgIds.push(org.id);
    await prisma.organizationSubscription.create({
      data: {
        organizationId: org.id,
        planId: "start",
        status: "TRIAL",
        provider: "none",
        currentPeriodStart: new Date("2020-01-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2020-01-08T00:00:00.000Z"),
      },
    });

    const access = await syncOrgAccessFromSubscription(org.id);
    expect(access.canUseApp).toBe(false);
    expect(access.pendingPayment).toBe(true);
    expect(access.accessStatus).toBe("PENDING_PAYMENT");
    expect(access.message).toBe(TRIAL_EXPIRED_MESSAGE);

    const stored = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { accessStatus: true },
    });
    expect(stored?.accessStatus).toBe("PENDING_PAYMENT");
  });
});
