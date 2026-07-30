import {
  getPlanDefinition,
  isPlanId,
  mapIntentToPublicStatus,
} from "@pedidos/shared";
import { describe, expect, it } from "vitest";

describe("plan catalog (backend)", () => {
  it("reconhece plan ids oficiais sem aliases mensais", () => {
    expect(isPlanId("starter")).toBe(true);
    expect(isPlanId("pro")).toBe(true);
    expect(isPlanId("starter_monthly")).toBe(false);
  });

  it("seleciona preço do catálogo", () => {
    const pro = getPlanDefinition("pro");
    expect(pro.monthlyPriceBrl).toBeGreaterThan(0);
  });
});

describe("mapIntentToPublicStatus", () => {
  it("não vazia status internos na landing", () => {
    expect(mapIntentToPublicStatus("COMPLETED")).toBe("ACTIVE");
    expect(mapIntentToPublicStatus("PAYMENT_PROCESSING")).toBe("PROCESSING");
  });
});
