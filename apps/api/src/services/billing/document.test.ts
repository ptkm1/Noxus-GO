import { describe, expect, it } from "vitest";
import { isValidCpfOrCnpj, normalizeDocument } from "./document.js";

describe("normalizeDocument", () => {
  it("remove máscara", () => {
    expect(normalizeDocument("12.345.678/0001-95")).toBe("12345678000195");
    expect(normalizeDocument("529.982.247-25")).toBe("52998224725");
  });
});

describe("isValidCpfOrCnpj", () => {
  it("valida CPF e CNPJ conhecidos", () => {
    expect(isValidCpfOrCnpj("52998224725")).toBe(true);
    expect(isValidCpfOrCnpj("11222333000181")).toBe(true);
    expect(isValidCpfOrCnpj("11111111111")).toBe(false);
    expect(isValidCpfOrCnpj("123")).toBe(false);
  });
});
