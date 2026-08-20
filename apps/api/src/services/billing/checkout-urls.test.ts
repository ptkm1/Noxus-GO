import { describe, expect, it } from "vitest";
import { checkoutReturnUrls, nextDueDateIso } from "./checkout-urls.js";

describe("checkoutReturnUrls / nextDueDateIso", () => {
  it("monta URLs do painel para cadastro no app", () => {
    const urls = checkoutReturnUrls("intent_1", "app");
    expect(urls.successUrl).toContain("/pagamento?intentId=intent_1");
    expect(urls.cancelUrl).toContain("result=canceled");
    expect(urls.expiredUrl).toContain("result=expired");
  });

  it("monta URLs da landing para contratação pública", () => {
    const urls = checkoutReturnUrls("intent_1", "landing");
    expect(urls.successUrl).toContain(
      "/contratacao/processando?intentId=intent_1",
    );
  });

  it("formata nextDueDate como YYYY-MM-DD", () => {
    expect(nextDueDateIso(new Date("2026-08-19T15:00:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
