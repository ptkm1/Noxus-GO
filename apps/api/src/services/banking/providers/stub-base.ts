import type { BankingProviderKind } from "@prisma/client";
import type {
    BankingConnectionConfig,
    BankingProvider,
    BankingProviderCapabilities,
    BoletoPdfResult,
    BoletoResult,
    CancelBoletoInput,
    CreateBoletoInput,
    GetBoletoInput,
    ParsedWebhookEvent,
    UpdateBoletoInput,
} from "../banking-provider.js";
import {
    BankingProviderError,
    BankingProviderNotConfiguredError,
} from "../banking-provider.js";
import { safeEqualToken, sha256Hex } from "../credentials.js";
import { mapGenericExternalStatus } from "../map-status.js";

/**
 * Base tipada para provedores ainda sem homologação/credenciais.
 * Em production NÃO simula pagamento — apenas lança NOT_CONFIGURED / STUB_ONLY.
 */
export abstract class StubBankingProvider implements BankingProvider {
  abstract readonly kind: BankingProviderKind;

  constructor(protected readonly config: BankingConnectionConfig) {}

  capabilities(): BankingProviderCapabilities {
    return {
      createBoleto: false,
      getBoleto: false,
      cancelBoleto: false,
      updateBoleto: false,
      pdf: false,
      webhooks: true,
      liveApi: false,
      editableFields: [],
    };
  }

  protected assertSandboxOrConfigured(action: string): void {
    if (this.config.environment === "production") {
      throw new BankingProviderNotConfiguredError(
        this.kind,
        `${this.kind}: ${action} indisponível sem homologação/credenciais em produção.`,
      );
    }
    throw new BankingProviderError(
      `${this.kind}: ${action} ainda é stub. Configure credenciais e veja docs/banking-boletos.md.`,
      "STUB_ONLY",
      501,
    );
  }

  async createBoleto(_input: CreateBoletoInput): Promise<BoletoResult> {
    this.assertSandboxOrConfigured("createBoleto");
    throw new BankingProviderError("unreachable", "STUB_ONLY");
  }

  async getBoleto(_input: GetBoletoInput): Promise<BoletoResult | null> {
    this.assertSandboxOrConfigured("getBoleto");
    return null;
  }

  async cancelBoleto(_input: CancelBoletoInput): Promise<BoletoResult> {
    this.assertSandboxOrConfigured("cancelBoleto");
    throw new BankingProviderError("unreachable", "STUB_ONLY");
  }

  async updateBoleto(_input: UpdateBoletoInput): Promise<BoletoResult> {
    this.assertSandboxOrConfigured("updateBoleto");
    throw new BankingProviderError("unreachable", "STUB_ONLY");
  }

  async getBoletoPdf(_input: GetBoletoInput): Promise<BoletoPdfResult | null> {
    return null;
  }

  verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: string | Buffer;
    expectedSecret?: string | null;
  }): boolean {
    const secret =
      input.expectedSecret ||
      this.config.secrets.WEBHOOK_SECRET ||
      this.config.secrets.webhookSecret;
    if (!secret) return false;
    const header =
      headerFirst(input.headers["x-banking-webhook-token"]) ||
      headerFirst(input.headers["x-webhook-token"]);
    if (!header) return false;
    return safeEqualToken(header, secret);
  }

  parseWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  }): ParsedWebhookEvent[] {
    const body = (input.body ?? {}) as Record<string, unknown>;
    const externalId =
      str(body.externalId) ||
      str(body.id) ||
      str(body.boletoId) ||
      str(body.bankNumber);
    const nossoNumero = str(body.nossoNumero) || str(body.bankNumber);
    const externalStatus = str(body.status) || str(body.situacao) || "PENDING";
    const eventType = str(body.event) || str(body.eventType) || "boleto.update";
    const providerEventId =
      str(body.eventId) ||
      str(body.id) ||
      sha256Hex(
        JSON.stringify({
          externalId,
          nossoNumero,
          externalStatus,
          eventType,
          paidAt: body.paidAt ?? null,
        }),
      );

    return [
      {
        providerEventId,
        eventType,
        externalId,
        nossoNumero,
        status: this.mapExternalStatus(externalStatus),
        externalStatus,
        paidAmount:
          typeof body.paidAmount === "number" ? body.paidAmount : null,
        paidAt: body.paidAt ? new Date(String(body.paidAt)) : null,
        sanitized: {
          eventType,
          externalId,
          nossoNumero,
          externalStatus,
        },
      },
    ];
  }

  mapExternalStatus(externalStatus: string) {
    return mapGenericExternalStatus(externalStatus);
  }
}

function headerFirst(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}
