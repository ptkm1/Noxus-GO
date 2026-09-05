import type {
    BankingConnectionConfig,
    BoletoResult,
    CancelBoletoInput,
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
 * Live quando CLIENT_ID + CLIENT_SECRET + APP_KEY: create / get / cancel boleto.
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
      createBoleto: live,
      getBoleto: live,
      cancelBoleto: live,
      updateBoleto: false,
      pdf: false,
      webhooks: true,
      liveApi: live,
      editableFields: [],
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
    input: CreateBoletoInput,
  ): Promise<BoletoResult> {
    if (!this.hasCredentials()) {
      throw new BankingProviderNotConfiguredError("BB");
    }
    const convenio =
      str(this.config.metadata.covenantCode) ||
      this.config.secrets.CONVENIO ||
      this.config.secrets.COVENANT_CODE;
    const numeroConvenio = Number(String(convenio ?? "").replace(/\D/g, ""));
    if (!numeroConvenio) {
      throw new BankingProviderNotConfiguredError(
        "BB",
        "BB createBoleto exige covenantCode/CONVENIO (número do convênio) nos metadados ou secrets.",
      );
    }

    const token = await this.ensureToken();
    const { api } = this.baseUrls();
    const doc = input.payer.document.replace(/\D/g, "");
    const due = input.dueDate.toISOString().slice(0, 10);
    // Payload alinhado à API Cobrança v2 (campos públicos documentados em integrações BB).
    const payload: Record<string, unknown> = {
      numeroConvenio,
      numeroCarteira: Number(this.config.metadata.wallet ?? this.config.secrets.CARTEIRA ?? 17),
      numeroVariacaoCarteira: Number(
        this.config.metadata.walletVariation ??
          this.config.secrets.VARIACAO_CARTEIRA ??
          35,
      ),
      codigoModalidade: 1,
      dataEmissao: new Date().toISOString().slice(0, 10),
      dataVencimento: due,
      valorOriginal: input.amount,
      codigoAceite: "N",
      codigoTipoTitulo: 2,
      indicadorPermissaoRecebimentoParcial: "N",
      numeroTituloBeneficiario: (input.nossoNumero || input.externalReference)
        .replace(/\D/g, "")
        .slice(0, 15),
      campoUtilizacaoBeneficiario: input.description?.slice(0, 30) || "PEDIX",
      numeroTituloCliente: input.externalReference.slice(0, 20),
      pagador: {
        tipoInscricao: doc.length > 11 ? 2 : 1,
        numeroInscricao: Number(doc),
        nome: input.payer.name.slice(0, 100),
        endereco: input.payer.address?.street?.slice(0, 60) || "NAO INFORMADO",
        cep: Number(String(input.payer.address?.postalCode ?? "").replace(/\D/g, "") || 0),
        cidade: input.payer.address?.city?.slice(0, 40) || "NAO INFORMADO",
        bairro: input.payer.address?.neighborhood?.slice(0, 40) || "NAO INFORMADO",
        uf: input.payer.address?.state?.slice(0, 2) || "SP",
      },
    };
    if (input.interestPercent != null) {
      payload.jurosMora = {
        tipo: 2,
        porcentagem: input.interestPercent,
      };
    }
    if (input.finePercent != null) {
      payload.multa = {
        tipo: 2,
        porcentagem: input.finePercent,
      };
    }

    const url = new URL(`${api}/boletos`);
    url.searchParams.set("gw-dev-app-key", this.config.secrets.APP_KEY);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `BB createBoleto falhou (${res.status}): ${text.slice(0, 300)}`,
        "API_ERROR",
        res.status,
      );
    }
    const raw = (await res.json()) as Record<string, unknown>;
    const situacao =
      str(raw.situacao) ||
      str(raw.codigoEstadoTituloCobranca) ||
      "PENDING";
    return {
      externalId:
        str(raw.numero) ||
        str(raw.id) ||
        str(raw.numeroTituloCliente) ||
        input.externalReference,
      nossoNumero: str(raw.numero) || str(raw.nossoNumero),
      digitableLine: str(raw.linhaDigitavel) || str(raw.linhaDigitavelNumerica),
      barcode: str(raw.codigoBarraNumerico) || str(raw.codigoBarras),
      status: this.mapExternalStatus(situacao),
      externalStatus: situacao,
      raw,
    };
  }

  override async cancelBoleto(input: CancelBoletoInput): Promise<BoletoResult> {
    if (!this.hasCredentials()) {
      throw new BankingProviderNotConfiguredError("BB");
    }
    const token = await this.ensureToken();
    const { api } = this.baseUrls();
    const url = new URL(
      `${api}/boletos/${encodeURIComponent(input.externalId)}/baixar`,
    );
    url.searchParams.set("gw-dev-app-key", this.config.secrets.APP_KEY);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        numeroConvenio: Number(
          String(
            this.config.metadata.covenantCode ??
              this.config.secrets.CONVENIO ??
              "",
          ).replace(/\D/g, "") || 0,
        ),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `BB cancelBoleto falhou (${res.status}): ${text.slice(0, 300)}`,
        "API_ERROR",
        res.status,
      );
    }
    return {
      externalId: input.externalId,
      status: "CANCELLED",
      externalStatus: "BAIXADO",
    };
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
