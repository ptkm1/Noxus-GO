import { randomUUID } from "node:crypto";
import type {
  BankingConnectionConfig,
  BoletoPdfResult,
  BoletoResult,
  CancelBoletoInput,
  CreateBoletoInput,
  GetBoletoInput,
  ParsedWebhookEvent,
} from "../banking-provider.js";
import {
  BankingProviderError,
  BankingProviderNotConfiguredError,
} from "../banking-provider.js";
import { safeEqualToken, sha256Hex } from "../credentials.js";
import { mapItauExternalStatus } from "../map-status.js";
import { mtlsFetch } from "../mtls-fetch.js";
import { StubBankingProvider } from "./stub-base.js";

/**
 * Itaú — API Cobrança / boletos (portal: https://devportal.itau.com.br/).
 *
 * Auth: OAuth client_credentials + mTLS (CERT_PEM / KEY_PEM).
 * OpenAPI completa fica atrás do login do portal → paths tipados com defaults
 * públicos conhecidos e sobrescrita via metadata:
 *   tokenUrl, apiBaseUrl, createPath, getPath, cancelPath, beneficiaryId, wallet
 *
 * Live quando CLIENT_ID + CLIENT_SECRET + CERT_PEM + KEY_PEM estão presentes.
 * updateBoleto: não documentado publicamente → editableFields [].
 */
export class ItauProvider extends StubBankingProvider {
  readonly kind = "ITAU" as const;
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
        this.config.secrets.CERT_PEM &&
        this.config.secrets.KEY_PEM,
    );
  }

  private metaStr(key: string): string | null {
    const v = this.config.metadata[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    return null;
  }

  private tokenUrl(): string {
    return (
      this.metaStr("tokenUrl") ||
      this.config.secrets.TOKEN_URL ||
      (this.config.environment === "production"
        ? "https://sts.itau.com.br/api/oauth/token"
        : "https://sts.itau.com.br/api/oauth/token")
    );
  }

  private apiBaseUrl(): string {
    return (
      this.metaStr("apiBaseUrl") ||
      this.config.secrets.API_BASE_URL ||
      (this.config.environment === "production"
        ? "https://api.itau.com.br/cash_management/v2"
        : "https://sandbox.api.itau.com.br/cash_management/v2")
    ).replace(/\/$/, "");
  }

  private createPath(): string {
    return this.metaStr("createPath") || "/boletos";
  }

  private getPath(externalId: string): string {
    const template =
      this.metaStr("getPath") || "/boletos/{id}";
    return template.replace("{id}", encodeURIComponent(externalId));
  }

  private cancelPath(externalId: string): string {
    const template =
      this.metaStr("cancelPath") || "/boletos/{id}/baixa";
    return template.replace("{id}", encodeURIComponent(externalId));
  }

  private beneficiaryId(): string | null {
    return (
      this.metaStr("beneficiaryId") ||
      this.config.secrets.BENEFICIARY_ID ||
      this.metaStr("idBeneficiario") ||
      null
    );
  }

  private walletCode(): string {
    return (
      this.metaStr("wallet") ||
      this.config.secrets.CARTEIRA ||
      "109"
    );
  }

  private async http(
    url: string,
    init: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | URLSearchParams | null;
    },
  ) {
    if (!this.hasCredentials()) {
      throw new BankingProviderNotConfiguredError(
        "ITAU",
        "Itaú exige CLIENT_ID, CLIENT_SECRET, CERT_PEM e KEY_PEM (mTLS).",
      );
    }
    const body =
      init.body instanceof URLSearchParams
        ? init.body.toString()
        : init.body ?? null;
    return mtlsFetch(url, {
      method: init.method,
      headers: init.headers,
      body,
      certPem: this.config.secrets.CERT_PEM,
      keyPem: this.config.secrets.KEY_PEM,
    });
  }

  private async ensureToken(): Promise<string> {
    if (!this.hasCredentials()) {
      throw new BankingProviderNotConfiguredError("ITAU");
    }
    const now = Date.now();
    if (this.accessToken && this.accessToken.expiresAt > now + 15_000) {
      return this.accessToken.token;
    }
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.secrets.CLIENT_ID,
      client_secret: this.config.secrets.CLIENT_SECRET,
    });
    if (this.config.secrets.SCOPE) {
      body.set("scope", this.config.secrets.SCOPE);
    }
    const res = await this.http(this.tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `Itaú OAuth falhou (${res.status}): ${text.slice(0, 200)}`,
        "API_ERROR",
        res.status,
      );
    }
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new BankingProviderError("Itaú OAuth sem access_token", "API_ERROR");
    }
    this.accessToken = {
      token: json.access_token,
      expiresAt: now + (json.expires_in ?? 300) * 1000,
    };
    return json.access_token;
  }

  private authHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-itau-correlationID": randomUUID(),
      "x-correlationID": randomUUID(),
    };
  }

  /** Valor Itaú costuma exigir 17 dígitos em centavos (padding). */
  private amountToItauCents(amount: number): string {
    const cents = Math.round(amount * 100);
    return String(cents).padStart(17, "0");
  }

  override async createBoleto(input: CreateBoletoInput): Promise<BoletoResult> {
    const beneficiary = this.beneficiaryId();
    if (!beneficiary) {
      throw new BankingProviderNotConfiguredError(
        "ITAU",
        "Itaú createBoleto exige beneficiaryId (metadata) ou BENEFICIARY_ID (secret).",
      );
    }
    const token = await this.ensureToken();
    const doc = input.payer.document.replace(/\D/g, "");
    const due = input.dueDate.toISOString().slice(0, 10);
    const issue = new Date().toISOString().slice(0, 10);
    const seuNumero = (input.nossoNumero || input.externalReference)
      .replace(/\W/g, "")
      .slice(0, 15);

    // Payload alinhado a collections públicas (boletos / boletos_pix).
    const payload: Record<string, unknown> = {
      etapa_processo_boleto: "efetivacao",
      beneficiario: { id_beneficiario: beneficiary },
      dado_boleto: {
        tipo_boleto: "a vista",
        texto_seu_numero: seuNumero,
        codigo_carteira: this.walletCode(),
        valor_total_titulo: this.amountToItauCents(input.amount),
        codigo_especie: "01",
        data_emissao: issue,
        pagador: {
          pessoa: {
            nome_pessoa: input.payer.name.slice(0, 50),
            tipo_pessoa: {
              codigo_tipo_pessoa: doc.length > 11 ? "J" : "F",
              ...(doc.length > 11
                ? { numero_cadastro_nacional_pessoa_juridica: doc }
                : { numero_cadastro_pessoa_fisica: doc }),
            },
          },
          endereco: {
            nome_logradouro:
              [input.payer.address?.street, input.payer.address?.number]
                .filter(Boolean)
                .join(", ")
                .slice(0, 40) || "NAO INFORMADO",
            nome_bairro:
              input.payer.address?.neighborhood?.slice(0, 15) || "NAO INFORMADO",
            nome_cidade:
              input.payer.address?.city?.slice(0, 20) || "NAO INFORMADO",
            sigla_UF: input.payer.address?.state?.slice(0, 2) || "SP",
            numero_CEP: String(
              input.payer.address?.postalCode ?? "",
            ).replace(/\D/g, "").slice(0, 8) || "00000000",
          },
        },
        dados_individuais_boleto: [
          {
            data_vencimento: due,
            valor_titulo: this.amountToItauCents(input.amount),
            texto_uso_beneficiario: input.description?.slice(0, 25) || "PEDIX",
          },
        ],
      },
    };

    const url = `${this.apiBaseUrl()}${this.createPath()}`;
    const res = await this.http(url, {
      method: "POST",
      headers: this.authHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `Itaú createBoleto falhou (${res.status}): ${text.slice(0, 300)}`,
        "API_ERROR",
        res.status,
      );
    }
    const raw = (await res.json()) as Record<string, unknown>;
    return this.mapBoleto(raw, input.externalReference);
  }

  override async getBoleto(input: GetBoletoInput): Promise<BoletoResult | null> {
    const id = input.externalId || input.nossoNumero;
    if (!id) return null;
    const token = await this.ensureToken();
    const url = `${this.apiBaseUrl()}${this.getPath(id)}`;
    const res = await this.http(url, {
      method: "GET",
      headers: this.authHeaders(token),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `Itaú getBoleto falhou (${res.status}): ${text.slice(0, 200)}`,
        "API_ERROR",
        res.status,
      );
    }
    const raw = (await res.json()) as Record<string, unknown>;
    return this.mapBoleto(raw, id);
  }

  override async cancelBoleto(input: CancelBoletoInput): Promise<BoletoResult> {
    const token = await this.ensureToken();
    const url = `${this.apiBaseUrl()}${this.cancelPath(input.externalId)}`;
    const res = await this.http(url, {
      method: "PATCH",
      headers: this.authHeaders(token),
      body: JSON.stringify({
        motivo_cancelamento: input.reason?.slice(0, 100) || "pedido do beneficiario",
      }),
    });
    if (!res.ok) {
      // Alguns contratos usam POST /baixa
      if (res.status === 404 || res.status === 405) {
        const alt = await this.http(url.replace(/\/baixa$/, "") + "/baixa", {
          method: "POST",
          headers: this.authHeaders(token),
          body: JSON.stringify({
            motivo_cancelamento:
              input.reason?.slice(0, 100) || "pedido do beneficiario",
          }),
        });
        if (!alt.ok) {
          const text = await alt.text().catch(() => "");
          throw new BankingProviderError(
            `Itaú cancelBoleto falhou (${alt.status}): ${text.slice(0, 300)}`,
            "API_ERROR",
            alt.status,
          );
        }
      } else {
        const text = await res.text().catch(() => "");
        throw new BankingProviderError(
          `Itaú cancelBoleto falhou (${res.status}): ${text.slice(0, 300)}`,
          "API_ERROR",
          res.status,
        );
      }
    }
    return {
      externalId: input.externalId,
      status: "CANCELLED",
      externalStatus: "BAIXADO",
    };
  }

  override async getBoletoPdf(
    _input: GetBoletoInput,
  ): Promise<BoletoPdfResult | null> {
    return null;
  }

  private mapBoleto(
    raw: Record<string, unknown>,
    fallbackId: string,
  ): BoletoResult {
    const dados = (raw.dado_boleto ?? raw.data ?? raw) as Record<
      string,
      unknown
    >;
    const individuais = Array.isArray(dados.dados_individuais_boleto)
      ? (dados.dados_individuais_boleto[0] as Record<string, unknown>)
      : null;
    const statusRaw =
      str(raw.status) ||
      str(raw.situacao) ||
      str(individuais?.situacao_geral_boleto) ||
      "PENDING";
    return {
      externalId:
        str(raw.id) ||
        str(raw.id_boleto) ||
        str(individuais?.id_boleto_individual) ||
        str(individuais?.numero_nosso_numero) ||
        fallbackId,
      nossoNumero:
        str(individuais?.numero_nosso_numero) ||
        str(raw.nosso_numero) ||
        str(raw.nossoNumero),
      digitableLine:
        str(individuais?.numero_linha_digitavel) ||
        str(raw.linha_digitavel) ||
        str(raw.digitableLine),
      barcode:
        str(individuais?.codigo_barras) ||
        str(raw.codigo_barras) ||
        str(raw.barcode),
      status: this.mapExternalStatus(statusRaw),
      externalStatus: statusRaw,
      raw,
    };
  }

  override verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: string | Buffer;
    expectedSecret?: string | null;
  }): boolean {
    const secret =
      input.expectedSecret ||
      this.config.secrets.WEBHOOK_SECRET ||
      this.config.secrets.webhookSecret;
    if (!secret) {
      return process.env.BANKING_ITAU_ALLOW_UNSIGNED_WEBHOOK === "1";
    }
    const header =
      first(input.headers["x-itau-webhook-token"]) ||
      first(input.headers["x-banking-webhook-token"]) ||
      first(input.headers["x-webhook-token"]);
    if (!header) return false;
    return safeEqualToken(header, secret);
  }

  override parseWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  }): ParsedWebhookEvent[] {
    const body = input.body;
    const items = Array.isArray(body)
      ? body
      : body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
        ? ((body as { data: unknown[] }).data)
        : [body];

    const events: ParsedWebhookEvent[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const externalId =
        str(row.id_boleto) || str(row.id) || str(row.externalId);
      const nossoNumero =
        str(row.nosso_numero) || str(row.nossoNumero) || str(row.numero_nosso_numero);
      const externalStatus =
        str(row.status) || str(row.situacao) || "PENDING";
      const eventType = str(row.eventType) || str(row.evento) || "boleto.update";
      const paidAmount =
        typeof row.valor_pago === "number"
          ? row.valor_pago
          : typeof row.paidAmount === "number"
            ? row.paidAmount
            : null;
      const paidAtRaw = str(row.data_pagamento) || str(row.paidAt);
      const providerEventId =
        str(row.eventId) ||
        str(row.id_evento) ||
        sha256Hex(
          JSON.stringify({
            externalId,
            nossoNumero,
            externalStatus,
            paidAtRaw,
            paidAmount,
          }),
        );
      events.push({
        providerEventId,
        eventType,
        externalId,
        nossoNumero,
        status: this.mapExternalStatus(externalStatus),
        externalStatus,
        paidAmount,
        paidAt: paidAtRaw ? new Date(paidAtRaw) : null,
        sanitized: {
          eventType,
          externalId,
          nossoNumero,
          externalStatus,
          paidAmount,
        },
      });
    }
    return events;
  }

  override mapExternalStatus(externalStatus: string) {
    return mapItauExternalStatus(externalStatus);
  }

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
      tokenUrlHint: "https://sts.itau.com.br/api/oauth/token",
      notes: [
        "mTLS obrigatório (CERT_PEM + KEY_PEM).",
        "Access token JWT ~300s — renovar automaticamente.",
        "Paths configuráveis via metadata (tokenUrl, apiBaseUrl, createPath, getPath, cancelPath).",
        "beneficiaryId obrigatório para emissão.",
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
}

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}
