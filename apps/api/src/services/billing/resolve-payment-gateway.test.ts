import { afterEach, describe, expect, it } from "vitest";
import { FakePaymentGateway } from "./fake-payment-gateway.js";
import {
  isDevPaymentLockSkipped,
  isPaymentRequiredForSignup,
  resolvePaymentGateway,
} from "./resolve-payment-gateway.js";

const KEYS = [
  "PAYMENT_GATEWAY",
  "ASAAS_API_KEY",
  "PEDIXPRO_APP_URL",
  "DEV_SKIP_PAYMENT_LOCK",
  "NODE_ENV",
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

  it("DEV_SKIP_PAYMENT_LOCK não vale em test/production", () => {
    process.env.PAYMENT_GATEWAY = "asaas";
    process.env.ASAAS_API_KEY = "test-key";
    process.env.DEV_SKIP_PAYMENT_LOCK = "1";
    process.env.NODE_ENV = "test";
    expect(isDevPaymentLockSkipped()).toBe(false);
    expect(isPaymentRequiredForSignup()).toBe(true);
    process.env.NODE_ENV = "production";
    expect(isDevPaymentLockSkipped()).toBe(false);
    expect(isPaymentRequiredForSignup()).toBe(true);
  });

  it("DEV_SKIP_PAYMENT_LOCK libera cadastro em development", () => {
    process.env.PAYMENT_GATEWAY = "asaas";
    process.env.ASAAS_API_KEY = "test-key";
    process.env.DEV_SKIP_PAYMENT_LOCK = "1";
    process.env.NODE_ENV = "development";
    expect(isDevPaymentLockSkipped()).toBe(true);
    expect(isPaymentRequiredForSignup()).toBe(false);
  });
});
