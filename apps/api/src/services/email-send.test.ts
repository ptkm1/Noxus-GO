import { describe, expect, it } from "vitest";
import { explainEmailSendFailure } from "./email-send.js";

describe("explainEmailSendFailure", () => {
  it("explica modo de teste do Resend", () => {
    const raw =
      'Resend HTTP 403: {"statusCode":403,"message":"You can only send testing emails to your own email address (dev@empresa.com). To send emails to other recipients, please verify a domain at resend.com/domains"}';
    expect(explainEmailSendFailure(raw)).toContain("dev@empresa.com");
    expect(explainEmailSendFailure(raw)).toContain("resend.com/domains");
  });

  it("explica configuração ausente", () => {
    expect(explainEmailSendFailure("EMAIL_NOT_CONFIGURED")).toContain(
      "RESEND_API_KEY",
    );
  });
});
