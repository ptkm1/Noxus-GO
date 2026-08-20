import { describe, expect, it } from "vitest";
import { normalizeAsaasBaseUrl } from "./asaas-config.js";

describe("normalizeAsaasBaseUrl", () => {
  it("mantém URL já com /v3", () => {
    expect(normalizeAsaasBaseUrl("https://api-sandbox.asaas.com/v3")).toBe(
      "https://api-sandbox.asaas.com/v3",
    );
  });

  it("adiciona /v3 quando ausente", () => {
    expect(normalizeAsaasBaseUrl("https://api-sandbox.asaas.com")).toBe(
      "https://api-sandbox.asaas.com/v3",
    );
    expect(normalizeAsaasBaseUrl("https://api-sandbox.asaas.com/")).toBe(
      "https://api-sandbox.asaas.com/v3",
    );
  });

  it("usa sandbox padrão quando vazio", () => {
    expect(normalizeAsaasBaseUrl("")).toBe(
      "https://api-sandbox.asaas.com/v3",
    );
  });
});
