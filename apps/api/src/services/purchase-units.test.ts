import {
  formatPurchaseUnitLabel,
  normalizePurchaseUnitCode,
} from "@pedidos/shared";
import { describe, expect, it } from "vitest";

describe("normalizePurchaseUnitCode", () => {
  it("uppercase, remove espaços e símbolos, limita a 10 caracteres", () => {
    expect(normalizePurchaseUnitCode(" pal ")).toBe("PAL");
    expect(normalizePurchaseUnitCode("cx-1")).toBe("CX1");
    expect(normalizePurchaseUnitCode("un")).toBe("UN");
    expect(normalizePurchaseUnitCode("abcdefghijklmnop")).toBe("ABCDEFGHIJ");
  });
});

describe("formatPurchaseUnitLabel", () => {
  it("monta Nome (CÓDIGO) no padrão do formulário", () => {
    expect(formatPurchaseUnitLabel("UN", "Unidade")).toBe("Unidade (UN)");
    expect(formatPurchaseUnitLabel("PAL", "Pallet")).toBe("Pallet (PAL)");
  });
});
