import type { BankingConnectionConfig, BoletoResult } from "../banking-provider.js";
import {
  BankingProviderError,
  BankingProviderNotConfiguredError,
} from "../banking-provider.js";
import { mapItauExternalStatus } from "../map-status.js";
import { StubBankingProvider } from "./stub-base.js";

/**
 * Itaú — API Cobrança / Bolecode (portal: https://devportal.itau.com.br/).
 *
 * Auth documentada: OAuth client_credentials + mTLS (certificado dinâmico),
 * token STS (~5 min). Endpoints de cobrança ficam atrás do portal (login).
 *
 * Credenciais necessárias (gerente / API Owner):
 * - CLIENT_ID, CLIENT_SECRET (ou token de ativação + CSR → certificado)
 * - CERT_PEM / KEY_PEM (mTLS)
 * - WEBHOOK_SECRET (quando o produto disponibilizar notificação)
 *
 * Sem OpenAPI pública estável no momento da implementação → stub tipado.
 * Não inventamos paths; go-live exige homologação no portal Itaú.
 */
export class ItauProvider extends StubBankingProvider {
  readonly kind = "ITAU" as const;

  constructor(config: BankingConnectionConfig) {
    super(config);
  }

  override capabilities() {
    return {
      createBoleto: false,
      getBoleto: false,
      cancelBoleto: false,
      webhooks: true,
      liveApi: false,
    };
  }

  override mapExternalStatus(externalStatus: string) {
    return mapItauExternalStatus(externalStatus);
  }

  /** Contrato pronto para quando o portal liberar a collection OpenAPI. */
  static requiredSecretKeys(): string[] {
    return [
      "CLIENT_ID",
      "CLIENT_SECRET",
      "CERT_PEM",
      "KEY_PEM",
      "WEBHOOK_SECRET",
    ];
  }

  static documentedAuth(): {
    tokenUrlHint: string;
    notes: string[];
  } {
    return {
      tokenUrlHint: "https://sts.itau.com.br (produção — ver portal)",
      notes: [
        "mTLS obrigatório em produção (certificado dinâmico).",
        "Access token JWT ~300s — renovar automaticamente.",
        "Credenciais de Cobranças: solicitar ao ponto focal Itaú / API Owner.",
        "Sandbox e collections: https://devportal.itau.com.br/",
      ],
    };
  }
}

export function assertItauLiveReady(config: BankingConnectionConfig): void {
  const need = ItauProvider.requiredSecretKeys().filter(
    (k) => k !== "WEBHOOK_SECRET",
  );
  const missing = need.filter((k) => !config.secrets[k]);
  if (missing.length) {
    throw new BankingProviderNotConfiguredError(
      "ITAU",
      `Itaú incompleto: faltam ${missing.join(", ")}.`,
    );
  }
  throw new BankingProviderError(
    "Itaú: API Cobrança ainda stub — complete homologação no portal e implemente os paths da collection oficial.",
    "STUB_ONLY",
    501,
  );
}

/** Placeholder tipado para sync futuro — nunca retorna boleto fake pago. */
export async function itauGetBoletoStub(
  _config: BankingConnectionConfig,
  _externalId: string,
): Promise<BoletoResult | null> {
  return null;
}
