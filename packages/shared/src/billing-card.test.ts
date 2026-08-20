import { describe, expect, it } from "vitest";
import {
    isValidCardExpiry,
    isValidCvv,
    isValidLuhn,
    parseCardExpiry,
} from "@pedidos/shared";

describe("billing-card", () => {
  it("validates luhn for sandbox test card", () => {
    expect(isValidLuhn("5162306219378829")).toBe(true);
    expect(isValidLuhn("4111111111111111")).toBe(true);
    expect(isValidLuhn("1234567890123456")).toBe(false);
  });

  it("parses expiry MM/YY", () => {
    expect(parseCardExpiry("05/28")).toEqual({ month: "05", year: "2028" });
    expect(isValidCardExpiry("05", "2028")).toBe(true);
  });

  it("validates cvv length", () => {
    expect(isValidCvv("123")).toBe(true);
    expect(isValidCvv("12")).toBe(false);
  });
});
