import type {
  BankingConnectionConfig,
  BoletoResult,
  CreateBoletoInput,
  GetBoletoInput,
} from "../banking-provider.js";
import {
  BankingProviderError,
  BankingProviderNotConfiguredError,
} from "../banking-provider.js";
import { mapBbExternalStatus } from "../map-status.js";
import { StubBankingProvider } from "./stub-base.js";

/**
 * Banco do Brasil — API Cobranças v2.
 *
 * URLs documentadas publicamente (TOTVS / integrações BB):
 * - OAuth prod: https://oauth.bb.com.br/oauth/token
 * - OAuth homolog: https://oauth.hm.bb.com.br/oauth/token
 * - API prod: https://api.bb.com.br/cobrancas/v2
 * - API homolog: https://api.hm.bb.com.br/cobrancas/v2
 *
 * Auth: OAuth2 client_credentials + header gw-dev-app-key (developer_application_key).
 * Spec detalhada de body/campos: Portal Developers BB (login).
 *
 * Implementação: OAuth + GET sonda quando credenciais existem;
 * createBoleto permanece stub até body oficial homologado (não inventamos payload).
 */
export class BancoDoBrasilProvider extends StubBankingProvider {
  readonly kind = "BB" as const;
  private accessToken: { token: string; expiresAt: number } | null = null;

  constructor(config: BankingConnectionConfig) {
    super(config);
  }

  override capabilities() {
    const live = this.hasCredentials();
    return {
      createBoleto: false,
      getBoleto: live,
      cancelBoleto: false,
      webhooks: true,
      liveApi: live,
    };
  }

  private hasCredentials(): boolean {
    return Boolean(
      this.config.secrets.CLIENT_ID &&
        this.config.secrets.CLIENT_SECRET &&
        this.config.secrets.APP_KEY,
    );
  }

  private baseUrls() {
    const env = this.config.environment;
    if (env === "production") {
      return {
        token: "https://oauth.bb.com.br/oauth/token",
        api: "https://api.bb.com.br/cobrancas/v2",
      };
    }
    return {
      token: "https://oauth.hm.bb.com.br/oauth/token",
      api: "https://api.hm.bb.com.br/cobrancas/v2",
    };
  }

  private async ensureToken(): Promise<string> {
    if (!this.hasCredentials()) {
      throw new BankingProviderNotConfiguredError(
        "BB",
        "BB exige CLIENT_ID, CLIENT_SECRET e APP_KEY (developer_application_key).",
      );
    }
    const now = Date.now();
    if (this.accessToken && this.accessToken.expiresAt > now + 30_000) {
      return this.accessToken.token;
    }
    const { token: tokenUrl } = this.baseUrls();
    const basic = Buffer.from(
      `${this.config.secrets.CLIENT_ID}:${this.config.secrets.CLIENT_SECRET}`,
    ).toString("base64");
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: this.config.secrets.SCOPE || "cobrancas.boletos-info cobrancas.boletos-requisicao",
    });
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `BB OAuth falhou (${res.status}): ${text.slice(0, 200)}`,
        "API_ERROR",
        res.status,
      );
    }
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new BankingProviderError("BB OAuth sem access_token", "API_ERROR");
    }
    this.accessToken = {
      token: json.access_token,
      expiresAt: now + (json.expires_in ?? 600) * 1000,
    };
    return json.access_token;
  }

  override async createBoleto(
    _input: CreateBoletoInput,
  ): Promise<BoletoResult> {
    if (!this.hasCredentials()) {
      throw new BankingProviderNotConfiguredError("BB");
    }
    // Body de POST /boletos é definido no manual do Portal Developers BB —
    // não inventamos campos. Após homologação, implementar com a OpenAPI oficial.
    throw new BankingProviderError(
      "BB createBoleto: aguardando payload homologado (POST /cobrancas/v2/boletos). Use sync/getBoleto após registro externo.",
      "STUB_ONLY",
      501,
    );
  }

  override async getBoleto(input: GetBoletoInput): Promise<BoletoResult | null> {
    if (!this.hasCredentials()) {
      throw new BankingProviderNotConfiguredError("BB");
    }
    const id = input.externalId || input.nossoNumero;
    if (!id) return null;

    const token = await this.ensureToken();
    const { api } = this.baseUrls();
    // Consulta por id do boleto — path público documentado: GET .../boletos/{id}
    const url = new URL(`${api}/boletos/${encodeURIComponent(id)}`);
    url.searchParams.set("gw-dev-app-key", this.config.secrets.APP_KEY);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `BB getBoleto falhou (${res.status}): ${text.slice(0, 200)}`,
        "API_ERROR",
        res.status,
      );
    }
    const raw = (await res.json()) as Record<string, unknown>;
    const situacao =
      str(raw.situacao) ||
      str(raw.codigoEstadoTituloCobranca) ||
      str(raw.status) ||
      "PENDING";
    return {
      externalId: str(raw.numero) || str(raw.id) || id,
      nossoNumero:
        str(raw.numero) ||
        str(raw.nossoNumero) ||
        input.nossoNumero ||
        null,
      digitableLine: str(raw.linhaDigitavel) || str(raw.linhaDigitavelNumerica),
      barcode: str(raw.codigoBarraNumerico) || str(raw.codigoBarras),
      status: this.mapExternalStatus(situacao),
      externalStatus: situacao,
      raw,
    };
  }

  override mapExternalStatus(externalStatus: string) {
    return mapBbExternalStatus(externalStatus);
  }

  static requiredSecretKeys(): string[] {
    return ["CLIENT_ID", "CLIENT_SECRET", "APP_KEY", "WEBHOOK_SECRET"];
  }
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}
