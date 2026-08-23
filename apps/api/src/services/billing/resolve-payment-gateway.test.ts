import { afterEach, describe, expect, it } from "vitest";
import {
  isPaymentRequiredForSignup,
  resolvePaymentGateway,
} from "./resolve-payment-gateway.js";

const KEYS = [
  "PAYMENT_GATEWAY",
  "ASAAS_API_KEY",
  "PEDIXPRO_APP_URL",
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

  it("não exige pagamento no cadastro sem Asaas", () => {
    delete process.env.PAYMENT_GATEWAY;
    delete process.env.ASAAS_API_KEY;
    expect(isPaymentRequiredForSignup()).toBe(false);
    expect(resolvePaymentGateway()).toBeNull();
  });
});
