import { describe, expect, it } from "vitest";
import { DEFAULT_TRIAL_DAYS } from "@pedidos/shared";
import {
  evaluateOrgAccess,
  TRIAL_EXPIRED_MESSAGE,
} from "./subscription-access.js";
import { trialPeriodEnd } from "./subscription.js";

describe("trialPeriodEnd", () => {
  it("soma 7×24h em UTC", () => {
    const from = new Date("2026-08-21T03:00:00.000Z");
    expect(trialPeriodEnd(from).toISOString()).toBe("2026-08-28T03:00:00.000Z");
    expect(DEFAULT_TRIAL_DAYS).toBe(7);
  });
});

describe("evaluateOrgAccess — trial", () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const past = new Date("2020-01-01T00:00:00.000Z");

  it("TRIAL com currentPeriodEnd no futuro libera o app", () => {
    const access = evaluateOrgAccess({
      accessStatus: "ACTIVE",
      subscription: {
        status: "TRIAL",
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: future,
      },
    });
    expect(access.canUseApp).toBe(true);
    expect(access.pendingPayment).toBe(false);
    expect(access.accessStatus).toBe("ACTIVE");
  });

  it("TRIAL expirado bloqueia com mensagem de teste encerrado", () => {
    const access = evaluateOrgAccess({
      accessStatus: "ACTIVE",
      subscription: {
        status: "TRIAL",
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: past,
      },
    });
    expect(access.canUseApp).toBe(false);
    expect(access.pendingPayment).toBe(true);
    expect(access.accessStatus).toBe("PENDING_PAYMENT");
    expect(access.nextAccessStatus).toBe("PENDING_PAYMENT");
    expect(access.message).toBe(TRIAL_EXPIRED_MESSAGE);
  });

  it("assinatura ACTIVE paga não é afetada pela regra de trial", () => {
    const access = evaluateOrgAccess({
      accessStatus: "ACTIVE",
      subscription: {
        status: "ACTIVE",
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: past,
      },
    });
    expect(access.canUseApp).toBe(true);
    expect(access.pendingPayment).toBe(false);
  });
});
