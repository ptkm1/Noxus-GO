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
import { mapSantanderExternalStatus } from "../map-status.js";
import { mtlsFetch } from "../mtls-fetch.js";
import { StubBankingProvider } from "./stub-base.js";

/**
 * Santander — API de Cobrança (Hub / collection_bill_management v2).
 *
 * Docs públicas (manual API Cobrança):
 * - OAuth sandbox: https://trust-sandbox.api.santander.com.br/auth/oauth/v2/token
 * - OAuth prod: https://trust-open.api.santander.com.br/auth/oauth/v2/token
 * - Workspaces / bank_slips sob /collection_bill_management/v2/
 * - Auth: client_credentials + mTLS (certificado no portal)
 * - Webhook: cadastrado no Workspace (webhookURL + bankSlipBillingWebhookActive)
 *
 * Status documentados: Ativo | Baixado | Liquidado | Liquidado parcialmente
 */
export class SantanderProvider extends StubBankingProvider {
  readonly kind = "SANTANDER" as const;
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
      pdf: live,
      webhooks: true,
      liveApi: live,
      editableFields: [],
    };
  }

  private hasCredentials(): boolean {
    return Boolean(
      this.config.secrets.CLIENT_ID &&
        this.config.secrets.CLIENT_SECRET &&
        this.workspaceId(),
    );
  }

  private certPair(): { certPem?: string; keyPem?: string } {
    const certPem = this.config.secrets.CERT_PEM?.trim();
    const keyPem = this.config.secrets.KEY_PEM?.trim();
    if (certPem && keyPem) return { certPem, keyPem };
    return {};
  }

  private async http(
    url: string,
    init: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | URLSearchParams;
    },
  ) {
    const body =
      init.body instanceof URLSearchParams
        ? init.body.toString()
        : init.body ?? null;
    const { certPem, keyPem } = this.certPair();
    if (certPem && keyPem) {
      return mtlsFetch(url, {
        method: init.method,
        headers: init.headers,
        body,
        certPem,
        keyPem,
      });
    }
    return fetch(url, {
      method: init.method,
      headers: init.headers,
      body: body ?? undefined,
    });
  }

  private workspaceId(): string | null {
    const fromMeta = this.config.metadata.workspaceId;
    if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
    return this.config.secrets.WORKSPACE_ID?.trim() || null;
  }

  private covenantCode(): string | null {
    const fromMeta = this.config.metadata.covenantCode;
    if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
    return this.config.secrets.COVENANT_CODE?.trim() || null;
  }

  private baseUrls() {
    if (this.config.environment === "production") {
      return {
        token: "https://trust-open.api.santander.com.br/auth/oauth/v2/token",
        api: "https://trust-open.api.santander.com.br/collection_bill_management/v2",
      };
    }
    return {
      token: "https://trust-sandbox.api.santander.com.br/auth/oauth/v2/token",
      api: "https://trust-sandbox.api.santander.com.br/collection_bill_management/v2",
    };
  }

  private async ensureToken(): Promise<string> {
    if (!this.config.secrets.CLIENT_ID || !this.config.secrets.CLIENT_SECRET) {
      throw new BankingProviderNotConfiguredError(
        "SANTANDER",
        "Santander exige CLIENT_ID e CLIENT_SECRET (portal developer).",
      );
    }
    const now = Date.now();
    if (this.accessToken && this.accessToken.expiresAt > now + 30_000) {
      return this.accessToken.token;
    }
    const { token: tokenUrl } = this.baseUrls();
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.secrets.CLIENT_ID,
      client_secret: this.config.secrets.CLIENT_SECRET,
    });
    const res = await this.http(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `Santander OAuth falhou (${res.status}): ${text.slice(0, 200)}. mTLS pode ser exigido — configure CERT_PEM/KEY_PEM.`,
        "API_ERROR",
        res.status,
      );
    }
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new BankingProviderError(
        "Santander OAuth sem access_token",
        "API_ERROR",
      );
    }
    this.accessToken = {
      token: json.access_token,
      expiresAt: now + (json.expires_in ?? 600) * 1000,
    };
    return json.access_token;
  }

  private authHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Application-Key": this.config.secrets.CLIENT_ID,
    };
  }

  override async createBoleto(input: CreateBoletoInput): Promise<BoletoResult> {
    const workspaceId = this.workspaceId();
    const covenant = this.covenantCode();
    if (!workspaceId || !covenant) {
      throw new BankingProviderNotConfiguredError(
        "SANTANDER",
        "Santander createBoleto exige workspaceId e covenantCode (metadata ou secrets).",
      );
    }
    if (this.config.environment === "production" && !this.hasCredentials()) {
      throw new BankingProviderNotConfiguredError("SANTANDER");
    }

    const token = await this.ensureToken();
    const { api } = this.baseUrls();
    const due = input.dueDate.toISOString().slice(0, 10);
    const issue = new Date().toISOString().slice(0, 10);
    const nsu =
      input.nossoNumero ||
      input.externalReference.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);

    // Campos alinhados ao manual público (bank_slips POST).
    const payload = {
      environment:
        this.config.environment === "production" ? "PRODUCAO" : "TESTE",
      nsuCode: nsu.slice(0, 20),
      nsuDate: issue,
      covenantCode: covenant,
      clientNumber: input.externalReference.slice(0, 15),
      dueDate: due,
      issueDate: issue,
      nominalValue: input.amount.toFixed(2),
      payer: {
        name: input.payer.name.slice(0, 100),
        documentType: input.payer.document.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF",
        documentNumber: input.payer.document.replace(/\D/g, ""),
      },
      documentKind: "DUPLICATA_MERCANTIL",
      paymentType: "REGISTRO",
    };

    const res = await this.http(`${api}/workspaces/${workspaceId}/bank_slips`, {
      method: "POST",
      headers: this.authHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `Santander createBoleto falhou (${res.status}): ${text.slice(0, 300)}`,
        "API_ERROR",
        res.status,
      );
    }
    const raw = (await res.json()) as Record<string, unknown>;
    return this.mapBankSlip(raw, input.externalReference);
  }

  override async getBoleto(input: GetBoletoInput): Promise<BoletoResult | null> {
    const workspaceId = this.workspaceId();
    if (!workspaceId) {
      throw new BankingProviderNotConfiguredError(
        "SANTANDER",
        "workspaceId obrigatório",
      );
    }
    const bankSlipId = input.externalId;
    if (!bankSlipId) {
      // Consulta por nosso número (bills) exige beneficiaryCode — metadata.
      const beneficiary = str(this.config.metadata.beneficiaryCode);
      if (!beneficiary || !input.nossoNumero) return null;
      return this.getByNossoNumero(beneficiary, input.nossoNumero);
    }

    const token = await this.ensureToken();
    const { api } = this.baseUrls();
    const res = await this.http(
      `${api}/workspaces/${workspaceId}/bank_slips/${encodeURIComponent(bankSlipId)}`,
      { method: "GET", headers: this.authHeaders(token) },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `Santander getBoleto falhou (${res.status}): ${text.slice(0, 200)}`,
        "API_ERROR",
        res.status,
      );
    }
    const raw = (await res.json()) as Record<string, unknown>;
    return this.mapBankSlip(raw, bankSlipId);
  }

  override async cancelBoleto(input: CancelBoletoInput): Promise<BoletoResult> {
    const workspaceId = this.workspaceId();
    if (!workspaceId) {
      throw new BankingProviderNotConfiguredError(
        "SANTANDER",
        "workspaceId obrigatório",
      );
    }
    const token = await this.ensureToken();
    const { api } = this.baseUrls();
    const res = await this.http(
      `${api}/workspaces/${workspaceId}/bank_slips/${encodeURIComponent(input.externalId)}`,
      {
        method: "PATCH",
        headers: this.authHeaders(token),
        body: JSON.stringify({
          status: "BAIXADO",
          reason: input.reason?.slice(0, 200) || "CANCELADO_PELO_BENEFICIARIO",
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `Santander cancelBoleto falhou (${res.status}): ${text.slice(0, 300)}`,
        "API_ERROR",
        res.status,
      );
    }
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (Object.keys(raw).length === 0) {
      return {
        externalId: input.externalId,
        status: "CANCELLED",
        externalStatus: "Baixado",
      };
    }
    return this.mapBankSlip(raw, input.externalId);
  }

  override async getBoletoPdf(
    input: GetBoletoInput,
  ): Promise<BoletoPdfResult | null> {
    const current = await this.getBoleto(input);
    if (!current) return null;
    const raw = (current.raw ?? {}) as Record<string, unknown>;
    const url =
      (typeof raw.pdfUrl === "string" && raw.pdfUrl) ||
      (typeof raw.bankSlipUrl === "string" && raw.bankSlipUrl) ||
      (typeof raw.link === "string" && raw.link) ||
      null;
    if (url) return { kind: "url", url };
    return null;
  }

  private async getByNossoNumero(
    beneficiaryCode: string,
    bankNumber: string,
  ): Promise<BoletoResult | null> {
    const token = await this.ensureToken();
    const { api } = this.baseUrls();
    const url = new URL(`${api}/bills`);
    url.searchParams.set("beneficiaryCode", beneficiaryCode);
    url.searchParams.set("bankNumber", bankNumber);
    const res = await this.http(url.toString(), {
      method: "GET",
      headers: this.authHeaders(token),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BankingProviderError(
        `Santander bills falhou (${res.status}): ${text.slice(0, 200)}`,
        "API_ERROR",
        res.status,
      );
    }
    const raw = (await res.json()) as Record<string, unknown>;
    return this.mapBankSlip(raw, bankNumber);
  }

  private mapBankSlip(
    raw: Record<string, unknown>,
    fallbackId: string,
  ): BoletoResult {
    const statusRaw =
      str(raw.status) ||
      str(raw.situation) ||
      str(raw.billStatus) ||
      "Ativo";
    return {
      externalId:
        str(raw.id) ||
        str(raw.bankSlipId) ||
        str(raw.txId) ||
        fallbackId,
      nossoNumero: str(raw.bankNumber) || str(raw.nossoNumero),
      digitableLine: str(raw.digitableLine) || str(raw.linhaDigitavel),
      barcode: str(raw.barCode) || str(raw.barcode) || str(raw.codigoBarras),
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
      // Santander autentica webhook principalmente via mTLS na URL;
      // token compartilhado é opcional (configurado no Pedix).
      return Boolean(process.env.BANKING_SANTANDER_ALLOW_UNSIGNED_WEBHOOK === "1");
    }
    const header =
      first(input.headers["x-santander-webhook-token"]) ||
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
      : body && typeof body === "object" && Array.isArray((body as { payments?: unknown }).payments)
        ? ((body as { payments: unknown[] }).payments)
        : [body];

    const events: ParsedWebhookEvent[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const externalId =
        str(row.bankSlipId) || str(row.id) || str(row.txId);
      const nossoNumero = str(row.bankNumber) || str(row.nossoNumero);
      const externalStatus =
        str(row.status) || str(row.situation) || "Liquidado";
      const eventType = str(row.eventType) || "bank_slip.payment";
      const paidAmount =
        typeof row.paidValue === "number"
          ? row.paidValue
          : typeof row.paymentValue === "number"
            ? row.paymentValue
            : typeof row.nominalValue === "number"
              ? row.nominalValue
              : null;
      const paidAtRaw = str(row.paymentDate) || str(row.paidAt);
      const providerEventId =
        str(row.eventId) ||
        str(row.nsu) ||
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
        paidAt: paidAtRaw ? new Date(paidAtRaw) : new Date(),
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
    return mapSantanderExternalStatus(externalStatus);
  }

  static requiredSecretKeys(): string[] {
    return [
      "CLIENT_ID",
      "CLIENT_SECRET",
      "WORKSPACE_ID",
      "COVENANT_CODE",
      "WEBHOOK_SECRET",
    ];
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
