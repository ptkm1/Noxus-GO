import type { BankingProviderKind, ReceivableStatus } from "@prisma/client";

/** Status canônico interno (alinhado ao enum Prisma ReceivableStatus). */
export type InternalReceivableStatus = ReceivableStatus;

export type BankingPayer = {
  name: string;
  document: string;
  email?: string | null;
  address?: {
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  };
};

export type CreateBoletoInput = {
  /** Identificador interno Pedix (ex.: receivableId) — referência no banco quando suportado. */
  externalReference: string;
  amount: number;
  dueDate: Date;
  payer: BankingPayer;
  /** Nosso número / seu número, se a carteira exigir. */
  nossoNumero?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export type BoletoResult = {
  externalId: string;
  nossoNumero?: string | null;
  digitableLine?: string | null;
  barcode?: string | null;
  status: InternalReceivableStatus;
  externalStatus?: string | null;
  raw?: unknown;
};

export type GetBoletoInput = {
  externalId?: string | null;
  nossoNumero?: string | null;
};

export type CancelBoletoInput = {
  externalId: string;
  reason?: string;
};

export type ParsedWebhookEvent = {
  /** Id estável para idempotência (hash se o banco não enviar). */
  providerEventId: string;
  eventType: string;
  externalId?: string | null;
  nossoNumero?: string | null;
  status?: InternalReceivableStatus | null;
  externalStatus?: string | null;
  paidAmount?: number | null;
  paidAt?: Date | null;
  /** Payload mínimo sem secrets. */
  sanitized: Record<string, unknown>;
};

export type BankingConnectionConfig = {
  provider: BankingProviderKind;
  /** Metadados não-secretos (convênio, workspace, agência…). */
  metadata: Record<string, unknown>;
  /** Segredos resolvidos no servidor (nunca no client). */
  secrets: Record<string, string>;
  /** sandbox | production — nunca fake-pay em production. */
  environment: "sandbox" | "production";
};

export type BankingProviderCapabilities = {
  createBoleto: boolean;
  getBoleto: boolean;
  cancelBoleto: boolean;
  webhooks: boolean;
  /** true = implementação completa; false = stub tipado aguardando homologação. */
  liveApi: boolean;
};

/**
 * Abstração agnóstica ao banco. A app só fala com BankingProvider /
 * ReceivableService — nunca `if (bank === 'ITAU')` espalhado.
 */
export interface BankingProvider {
  readonly kind: BankingProviderKind;
  capabilities(): BankingProviderCapabilities;

  createBoleto(input: CreateBoletoInput): Promise<BoletoResult>;
  getBoleto(input: GetBoletoInput): Promise<BoletoResult | null>;
  cancelBoleto?(input: CancelBoletoInput): Promise<BoletoResult>;

  /**
   * Valida assinatura/token do webhook. Retorna false se inválido.
   * Header/body específicos ficam no provider.
   */
  verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: string | Buffer;
    expectedSecret?: string | null;
  }): boolean;

  parseWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  }): ParsedWebhookEvent[];

  mapExternalStatus(externalStatus: string): InternalReceivableStatus;
}

export class BankingProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_CONFIGURED"
      | "STUB_ONLY"
      | "API_ERROR"
      | "UNSUPPORTED"
      | "VALIDATION",
    readonly status?: number,
  ) {
    super(message);
    this.name = "BankingProviderError";
  }
}

export class BankingProviderNotConfiguredError extends BankingProviderError {
  constructor(provider: BankingProviderKind, detail?: string) {
    super(
      detail ??
        `Provedor ${provider} sem credenciais/homologação. Veja docs/banking-boletos.md.`,
      "NOT_CONFIGURED",
      503,
    );
  }
}
