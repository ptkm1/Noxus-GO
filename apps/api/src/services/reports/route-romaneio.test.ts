import { describe, expect, it } from "vitest";
import {
  formatRomaneioNumber,
  groupOrdersByPaymentCondition,
  paymentConditionLabel,
  sumOrderTotals,
  uniqueIdsPreserveOrder,
} from "@pedidos/shared";

describe("uniqueIdsPreserveOrder", () => {
  it("remove duplicatas mantendo a primeira ocorrência", () => {
    expect(uniqueIdsPreserveOrder(["a", "b", "a", "c", "b"])).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("groupOrdersByPaymentCondition", () => {
  it("agrupa cada condição cadastrada e soma igual ao total geral", () => {
    const vista = { id: "1", name: "A VISTA", days: 0, sortOrder: 0 };
    const d7 = { id: "2", name: "BL 7 DIAS", days: 7, sortOrder: 1 };
    const d14 = { id: "3", name: "BL 14 DIAS", days: 14, sortOrder: 2 };
    const orders = [
      { id: "o1", totalAmount: 5000, paymentCondition: vista },
      { id: "o2", totalAmount: 2000, paymentCondition: d7 },
      { id: "o3", totalAmount: 3000, paymentCondition: d14 },
      { id: "o4", totalAmount: 4000, paymentCondition: d14 },
      { id: "o5", totalAmount: 100, paymentCondition: null },
    ];
    const groups = groupOrdersByPaymentCondition(orders);
    const groupedSum = groups.reduce((s, g) => s + g.total, 0);
    expect(sumOrderTotals(orders)).toBe(14100);
    expect(groupedSum).toBe(14100);
    expect(groups.map((g) => g.label)).toEqual([
      "A VISTA",
      "BL 7 DIAS",
      "BL 14 DIAS",
      "Sem condição",
    ]);
    expect(groups.find((g) => g.label === "BL 14 DIAS")?.total).toBe(7000);
  });
});

describe("paymentConditionLabel", () => {
  it("usa o nome cadastrado e fallback por dias", () => {
    expect(
      paymentConditionLabel({ id: "1", name: "A VISTA", days: 0, sortOrder: 0 }),
    ).toBe("A VISTA");
    expect(
      paymentConditionLabel({ id: "2", name: "  ", days: 7, sortOrder: 1 }),
    ).toBe("7 dias");
    expect(paymentConditionLabel(null)).toBe("Sem condição");
  });
});

describe("formatRomaneioNumber", () => {
  it("gera identificador ROM-AAAAMMDD-HHMMSS", () => {
    expect(formatRomaneioNumber(new Date("2026-08-12T15:04:05-03:00"))).toMatch(
      /^ROM-\d{8}-\d{6}$/,
    );
  });
});
