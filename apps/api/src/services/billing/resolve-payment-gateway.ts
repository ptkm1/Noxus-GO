import {
  readAsaasConfig,
  readPaymentGatewayMode,
} from "./asaas/asaas-config.js";
import { createAsaasPaymentGateway } from "./asaas/asaas-payment-gateway.js";
import type { PaymentGateway } from "./payment-gateway.js";

/**
 * Indica se o gateway de pagamento está ativo (Asaas).
 * O cadastro web (`POST /auth/register`) sempre inicia trial e não usa
 * este helper para travar a conta. A landing continua cobrando na hora.
 */
export function isPaymentRequiredForSignup(): boolean {
  const mode = readPaymentGatewayMode();
  if (mode === "asaas") return true;
  return Boolean(readAsaasConfig());
}

export function resolvePaymentGateway(
  override?: PaymentGateway,
): PaymentGateway | null {
  if (override) return override;
  const cfg = readAsaasConfig();
  if (cfg) return createAsaasPaymentGateway(cfg);
  return null;
}
