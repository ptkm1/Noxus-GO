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

/** Pagamento obrigatório no cadastro quando Asaas ou fake estão ativos. */
export function isPaymentRequiredForSignup(): boolean {
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
