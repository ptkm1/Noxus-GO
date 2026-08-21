import {
  readAsaasConfig,
  readPaymentGatewayMode,
  readPublicSiteUrls,
} from "./asaas/asaas-config.js";
import { createAsaasPaymentGateway } from "./asaas/asaas-payment-gateway.js";
import { FakePaymentGateway } from "./fake-payment-gateway.js";
import type { PaymentGateway } from "./payment-gateway.js";

export function isFakePaymentGatewayEnabled(): boolean {
  return readPaymentGatewayMode() === "fake";
}

/**
 * Flag de desenvolvimento legado. Não substitui o trial de 7 dias:
 * `POST /auth/register` sempre inicia TRIAL, em qualquer ambiente.
 * Ignorado em production/test mesmo se a env estiver definida.
 */
export function isDevPaymentLockSkipped(): boolean {
  const env = process.env.NODE_ENV;
  if (env === "production" || env === "test") return false;
  const raw = process.env.DEV_SKIP_PAYMENT_LOCK?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * Indica se o gateway de pagamento está ativo (Asaas/fake).
 * O cadastro web (`POST /auth/register`) sempre inicia trial e não usa
 * este helper para travar a conta. A landing continua cobrando na hora.
 */
export function isPaymentRequiredForSignup(): boolean {
  if (isDevPaymentLockSkipped()) return false;
  const mode = readPaymentGatewayMode();
  if (mode === "fake") return true;
  if (mode === "asaas") return true;
  return Boolean(readAsaasConfig());
}

export function resolvePaymentGateway(
  override?: PaymentGateway,
): PaymentGateway | null {
  if (override) return override;
  if (isFakePaymentGatewayEnabled()) {
    const { appUrl } = readPublicSiteUrls();
    return new FakePaymentGateway({
      checkoutLink: (id, input) =>
        `${appUrl}/pagamento?intentId=${encodeURIComponent(input.externalReference)}&checkoutId=${encodeURIComponent(id)}`,
    });
  }
  const cfg = readAsaasConfig();
  if (cfg) return createAsaasPaymentGateway(cfg);
  return null;
}
