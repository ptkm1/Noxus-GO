import {
    extraAdminCount,
    DEFAULT_TRIAL_DAYS,
    getPlanDefinition,
    isPlanId,
    mapIntentToPublicStatus,
    planMonthlyTotal,
    trialDaysRemaining,
} from "@pedidos/shared";
import { describe, expect, it } from "vitest";

describe("plan catalog (backend)", () => {
  it("trial padrão é 7 dias", () => {
    expect(DEFAULT_TRIAL_DAYS).toBe(7);
    const now = new Date("2026-08-21T12:00:00.000Z");
    expect(
      trialDaysRemaining("2026-08-28T12:00:00.000Z", now),
    ).toBe(7);
    expect(
      trialDaysRemaining("2026-08-20T12:00:00.000Z", now),
    ).toBe(0);
  });

  it("reconhece plan ids oficiais sem aliases mensais", () => {
    expect(isPlanId("start")).toBe(true);
    expect(isPlanId("pro")).toBe(true);
    expect(isPlanId("business")).toBe(true);
    expect(isPlanId("starter")).toBe(false);
    expect(isPlanId("growth")).toBe(false);
    expect(isPlanId("starter_monthly")).toBe(false);
  });

  it("seleciona preço do catálogo", () => {
    const start = getPlanDefinition("start");
    expect(start.monthlyPriceBrl).toBe(79.9);
    expect(start.sellerSeatPriceBrl).toBe(29.9);
    expect(start.limits.includedAdmins).toBe(1);
    const pro = getPlanDefinition("pro");
    expect(pro.monthlyPriceBrl).toBe(149.9);
    expect(pro.highlighted).toBe(true);
    const business = getPlanDefinition("business");
    expect(business.monthlyPriceBrl).toBe(299);
    expect(business.limits.includedAdmins).toBe(6);
  });

  it("calcula mensalidade com vendedores e admins extras", () => {
    expect(planMonthlyTotal("start", 0, 1)).toBe(79.9);
    expect(planMonthlyTotal("start", 2, 1)).toBe(139.7);
    expect(extraAdminCount(3, 1)).toBe(2);
    expect(planMonthlyTotal("start", 0, 3)).toBe(139.7);
    expect(planMonthlyTotal("pro", 1, 2)).toBe(179.8);
  });

  it("distribui features Start / Pro / Business", () => {
    const start = getPlanDefinition("start");
    const pro = getPlanDefinition("pro");
    const business = getPlanDefinition("business");
    expect(start.features).toContain("commissions");
    expect(start.features).toContain("whitelabel");
    expect(start.features).toContain("accounts_payable");
    expect(start.features).not.toContain("fiscal_nfe");
    expect(start.features).not.toContain("expedition");
    expect(pro.features).toContain("fiscal_nfe");
    expect(pro.features).toContain("expedition");
    expect(pro.features).toContain("insights");
    expect(pro.features).not.toContain("tracking");
    expect(business.features).toContain("tracking");
    expect(business.features).toContain("reports_ai");
    expect(business.features).toContain("multi_cnpj");
  });
});

describe("mapIntentToPublicStatus", () => {
  it("não vazia status internos na landing", () => {
    expect(mapIntentToPublicStatus("COMPLETED")).toBe("ACTIVE");
    expect(mapIntentToPublicStatus("PAYMENT_PROCESSING")).toBe("PROCESSING");
  });
});
