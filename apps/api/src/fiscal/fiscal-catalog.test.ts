import { describe, expect, it } from "vitest";
import {
  formatCfopDisplay,
  formatFiscalCodeLabel,
  formatNcmDisplay,
  inferCfopContexts,
  isCodeCurrentlyValid,
  normalizeCestCode,
  normalizeCfopCode,
  normalizeNcmCode,
} from "@pedidos/shared";
import { explainSefazRejection } from "./sefaz-rejection-hints.js";

describe("fiscal catalog helpers", () => {
  it("normaliza NCM, CEST e CFOP", () => {
    expect(normalizeNcmCode("2206.00.90")).toBe("22060090");
    expect(normalizeCestCode("17.056.00")).toBe("1705600");
    expect(normalizeCfopCode("5.102")).toBe("5102");
  });

  it("formata código — descrição", () => {
    expect(formatFiscalCodeLabel("00", "Tributada integralmente")).toBe(
      "00 — Tributada integralmente",
    );
    expect(formatNcmDisplay("22060090")).toBe("2206.00.90");
    expect(formatCfopDisplay("5102")).toBe("5.102");
  });

  it("infere contextos de CFOP sem inventar regras fiscais", () => {
    expect(inferCfopContexts("5102", "Venda de mercadoria")).toContain(
      "VENDA_INTERNA",
    );
    expect(inferCfopContexts("6102", "Venda interestadual")).toContain(
      "VENDA_INTERESTADUAL",
    );
    expect(
      inferCfopContexts("5910", "Remessa em bonificação, doação ou brinde"),
    ).toContain("BONIFICACAO");
    expect(
      inferCfopContexts("1202", "Devolução de venda de mercadoria"),
    ).toContain("DEVOLUCAO");
  });

  it("respeita vigência de código", () => {
    const at = new Date("2026-06-01T12:00:00Z");
    expect(
      isCodeCurrentlyValid({
        active: true,
        validFrom: "2020-01-01",
        validTo: "2025-12-31",
        at,
      }),
    ).toBe(false);
    expect(
      isCodeCurrentlyValid({
        active: true,
        validFrom: "2020-01-01",
        validTo: null,
        at,
      }),
    ).toBe(true);
    expect(
      isCodeCurrentlyValid({
        active: false,
        validFrom: null,
        validTo: null,
        at,
      }),
    ).toBe(false);
  });
});

describe("explainSefazRejection", () => {
  it("explica rejeição conhecida com sugestão", () => {
    const r = explainSefazRejection(
      "Rejeicao: Informacao do produto incompativel",
      "806",
    );
    expect(r.cStat).toBe("806");
    expect(r.hint?.relatedField).toBe("ncm");
    expect(r.userMessage).toContain("Rejeição 806");
    expect(r.userMessage).toContain("Como corrigir:");
  });

  it("não inventa orientação para cStat desconhecido", () => {
    const r = explainSefazRejection("Motivo misterioso da SEFAZ", "999");
    expect(r.cStat).toBe("999");
    expect(r.hint).toBeNull();
    expect(r.userMessage).not.toContain("Como corrigir:");
    expect(r.userMessage).toContain("Motivo misterioso");
  });

  it("extrai cStat do texto quando possível", () => {
    const r = explainSefazRejection("cStat 778 - NCM inexistente");
    expect(r.cStat).toBe("778");
    expect(r.hint?.relatedField).toBe("ncm");
  });
});
