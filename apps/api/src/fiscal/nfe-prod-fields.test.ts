import { describe, expect, it } from "vitest";
import { nfeCest, nfeCProd, nfeExtIpi, nfeGtin } from "./nfe-prod-fields.js";

describe("nfeGtin", () => {
  it("aceita EAN-13 e devolve só dígitos", () => {
    expect(nfeGtin("7897750310021")).toBe("7897750310021");
  });

  it("usa SEM GTIN quando o código não tem tamanho válido", () => {
    expect(nfeGtin("001")).toBe("SEM GTIN");
    expect(nfeGtin("")).toBe("SEM GTIN");
    expect(nfeGtin(null)).toBe("SEM GTIN");
  });
});

describe("nfeCest", () => {
  it("normaliza máscara do Convênio 92/2015", () => {
    expect(nfeCest("17.005.00")).toBe("1700500");
  });

  it("rejeita tamanho diferente de 7", () => {
    expect(nfeCest("170050")).toBeNull();
    expect(nfeCest("0")).toBeNull();
  });
});

describe("nfeExtIpi", () => {
  it("omite zero do cadastro legado", () => {
    expect(nfeExtIpi("0")).toBeNull();
    expect(nfeExtIpi("00")).toBeNull();
  });

  it("mantém exceção TIPI real", () => {
    expect(nfeExtIpi("01")).toBe("01");
  });
});

describe("nfeCProd", () => {
  it("prefere SKU comercial", () => {
    expect(
      nfeCProd({
        sku: "001",
        barcode: "7897750310021",
        productId: "cuid",
        lineNumber: 1,
      }),
    ).toBe("001");
  });
});
