import { afterEach, describe, expect, it } from "vitest";
import { FakePaymentGateway } from "./fake-payment-gateway.js";
import {
  isPaymentRequiredForSignup,
  resolvePaymentGateway,
} from "./resolve-payment-gateway.js";

const KEYS = [
  "PAYMENT_GATEWAY",
  "ASAAS_API_KEY",
  "PEDIXPRO_APP_URL",
] as const;

const snapshot: Record<string, string | undefined> = {};

function saveEnv() {
  for (const k of KEYS) snapshot[k] = process.env[k];
}

function restoreEnv() {
  for (const k of KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
}

describe("resolvePaymentGateway", () => {
  saveEnv();
  afterEach(() => restoreEnv());

  it("usa fake quando PAYMENT_GATEWAY=fake mesmo sem API key", () => {
    process.env.PAYMENT_GATEWAY = "fake";
    delete process.env.ASAAS_API_KEY;
    process.env.PEDIXPRO_APP_URL = "http://localhost:5173";
    expect(isPaymentRequiredForSignup()).toBe(true);
    const gw = resolvePaymentGateway();
    expect(gw).toBeInstanceOf(FakePaymentGateway);
  });

  it("não exige pagamento no cadastro sem Asaas e sem fake", () => {
    delete process.env.PAYMENT_GATEWAY;
    delete process.env.ASAAS_API_KEY;
    expect(isPaymentRequiredForSignup()).toBe(false);
    expect(resolvePaymentGateway()).toBeNull();
  });
});
