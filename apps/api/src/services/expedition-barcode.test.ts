import {
  expeditionSituationLabel,
  findProductByBarcode,
  normalizeBarcode,
  productMatchesBarcode,
} from "@pedidos/shared";
import { describe, expect, it } from "vitest";

describe("barcode matching", () => {
  const products = [
    { id: "a", barcode: "7908236800643", sku: "SKU-A", fiscalGtin: null },
    { id: "b", barcode: "7891234567895", sku: "ABC", fiscalGtin: null },
  ];

  it("normaliza dígitos", () => {
    expect(normalizeBarcode("790.8236.800643")).toBe("7908236800643");
  });

  it("encontra produto pelo EAN e variante UPC", () => {
    expect(findProductByBarcode(products, "7908236800643")?.id).toBe("a");
    expect(findProductByBarcode(products, "07891234567895")?.id).toBe("b");
  });

  it("não encontra código inexistente", () => {
    expect(findProductByBarcode(products, "0000000000000")).toBeUndefined();
    expect(productMatchesBarcode(products[0]!, "999")).toBe(false);
  });
});

describe("expeditionSituationLabel", () => {
  it("mapeia situações operacionais para o vocabulário de expedição", () => {
    expect(expeditionSituationLabel("OPEN")).toBe("Aguardando separação");
    expect(expeditionSituationLabel("PICKING")).toBe("Em separação");
    expect(expeditionSituationLabel("PACKED")).toBe("Separado");
    expect(expeditionSituationLabel("SENT")).toBe("Expedido");
    expect(expeditionSituationLabel(null)).toBe("Aguardando separação");
  });
});
