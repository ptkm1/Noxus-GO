import type {
  BankConnection,
  BankingProviderKind,
  Prisma,
  Receivable,
  ReceivableStatus,
} from "@prisma/client";
import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";
import type { CreateBoletoInput } from "./banking-provider.js";
import { BankingProviderError } from "./banking-provider.js";
import {
  asMetadataRecord,
  encryptCredentialsJson,
  encryptBankingSecret,
} from "./credentials.js";
import { applyDueDateOverdue } from "./map-status.js";
import { createBankingProvider } from "./resolve-banking-provider.js";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type CreateReceivableInput = {
  organizationId: string;
  customerId: string;
  bankConnectionId: string;
  orderId?: string | null;
  amount: number;
  dueDate: Date;
  nossoNumero?: string | null;
  description?: string | null;
  /** Se true, tenta emitir no banco via BankingProvider.createBoleto. */
  registerAtBank?: boolean;
  payer?: CreateBoletoInput["payer"];
};

export async function listBankConnections(organizationId: string) {
  const rows = await prisma.bankConnection.findMany({
    where: { organizationId },
    orderBy: { provider: "asc" },
  });
  return rows.map(sanitizeConnectionForClient);
}

export function sanitizeConnectionForClient(row: BankConnection) {
  const meta = asMetadataRecord(row.metadata);
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    metadata: {
      agency: meta.agency ?? null,
      account: meta.account ?? null,
      wallet: meta.wallet ?? null,
      covenantCode: meta.covenantCode ?? null,
      workspaceId: meta.workspaceId ?? null,
      beneficiaryCode: meta.beneficiaryCode ?? null,
      environment: meta.environment ?? "sandbox",
      label: meta.label ?? null,
    },
    hasCredentialsEnvPrefix: Boolean(row.credentialsEnvPrefix),
    hasEncryptedCredentials: Boolean(row.credentialsEncrypted),
    hasWebhookSecret: Boolean(row.webhookSecretEncrypted),
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastError: row.lastError,
    cnabEnabled: row.cnabEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertBankConnection(input: {
  organizationId: string;
  provider: BankingProviderKind;
  metadata?: Record<string, unknown>;
  credentialsEnvPrefix?: string | null;
  /** Secrets opcionais — criptografados no servidor; nunca retornados. */
  secrets?: Record<string, string> | null;
  webhookSecret?: string | null;
  status?: BankConnection["status"];
}) {
  const existing = await prisma.bankConnection.findUnique({
    where: {
      organizationId_provider: {
        organizationId: input.organizationId,
        provider: input.provider,
      },
    },
  });

  const prevMeta = asMetadataRecord(existing?.metadata);
  const metadata = {
    ...prevMeta,
    ...(input.metadata ?? {}),
  };

  const data: Prisma.BankConnectionUncheckedCreateInput = {
    organizationId: input.organizationId,
    provider: input.provider,
    metadata: metadata as Prisma.InputJsonValue,
    credentialsEnvPrefix:
      input.credentialsEnvPrefix !== undefined
        ? input.credentialsEnvPrefix
        : existing?.credentialsEnvPrefix ?? null,
    status: input.status ?? existing?.status ?? "PENDING_SETUP",
    credentialsEncrypted: existing?.credentialsEncrypted ?? null,
    webhookSecretEncrypted: existing?.webhookSecretEncrypted ?? null,
  };

  if (input.secrets && Object.keys(input.secrets).length > 0) {
    data.credentialsEncrypted = encryptCredentialsJson(input.secrets);
  }
  if (input.webhookSecret !== undefined) {
    data.webhookSecretEncrypted = input.webhookSecret
      ? encryptBankingSecret(input.webhookSecret)
      : null;
  }

  const hasAnySecret =
    Boolean(data.credentialsEncrypted) ||
    Boolean(data.credentialsEnvPrefix) ||
    Boolean(data.webhookSecretEncrypted);

  if (!input.status) {
    data.status = hasAnySecret ? "ACTIVE" : "PENDING_SETUP";
  }

  const row = existing
    ? await prisma.bankConnection.update({
        where: { id: existing.id },
        data: {
          metadata: data.metadata,
          credentialsEnvPrefix: data.credentialsEnvPrefix,
          credentialsEncrypted: data.credentialsEncrypted,
          webhookSecretEncrypted: data.webhookSecretEncrypted,
          status: data.status,
          lastError: null,
        },
      })
    : await prisma.bankConnection.create({ data });

  return sanitizeConnectionForClient(row);
}

export async function disconnectBankConnection(
  organizationId: string,
  connectionId: string,
) {
  const row = await prisma.bankConnection.findFirst({
    where: { id: connectionId, organizationId },
  });
  if (!row) return null;
  const updated = await prisma.bankConnection.update({
    where: { id: row.id },
    data: {
      status: "DISCONNECTED",
      credentialsEncrypted: null,
      webhookSecretEncrypted: null,
      lastError: null,
    },
  });
  return sanitizeConnectionForClient(updated);
}

export async function createReceivable(
  input: CreateReceivableInput,
): Promise<Receivable> {
  const connection = await prisma.bankConnection.findFirst({
    where: {
      id: input.bankConnectionId,
      organizationId: input.organizationId,
    },
  });
  if (!connection) {
    throw new BankingProviderError("Conexão bancária não encontrada", "VALIDATION", 404);
  }

  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: input.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      cpf: true,
      cnpj: true,
      street: true,
      number: true,
      neighborhood: true,
      city: true,
      state: true,
      cep: true,
    },
  });
  if (!customer) {
    throw new BankingProviderError("Cliente não encontrado", "VALIDATION", 404);
  }

  if (input.orderId) {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, organizationId: input.organizationId },
      select: { id: true },
    });
    if (!order) {
      throw new BankingProviderError("Pedido não encontrado", "VALIDATION", 404);
    }
  }

  let externalId: string | null = null;
  let nossoNumero = input.nossoNumero ?? null;
  let digitableLine: string | null = null;
  let barcode: string | null = null;
  let status: ReceivableStatus = "PENDING";
  let externalStatus: string | null = null;
  let lastSyncedAt: Date | null = null;

  if (input.registerAtBank) {
    const provider = createBankingProvider(connection);
    const payer =
      input.payer ??
      ({
        name: customer.name,
        document: (customer.cnpj || customer.cpf || "").replace(/\D/g, ""),
        email: customer.email,
        address: {
          street: customer.street,
          number: customer.number,
          neighborhood: customer.neighborhood,
          city: customer.city,
          state: customer.state,
          postalCode: customer.cep,
        },
      } satisfies CreateBoletoInput["payer"]);

    if (!payer.document) {
      throw new BankingProviderError(
        "Cliente sem CPF/CNPJ para emitir boleto",
        "VALIDATION",
        400,
      );
    }

    // Cria linha local primeiro para ter id como referência externa.
    const draft = await prisma.receivable.create({
      data: {
        organizationId: input.organizationId,
        customerId: input.customerId,
        orderId: input.orderId ?? null,
        bankConnectionId: connection.id,
        amount: input.amount,
        dueDate: input.dueDate,
        nossoNumero,
        status: "PENDING",
      },
    });

    try {
      const result = await provider.createBoleto({
        externalReference: draft.id,
        amount: input.amount,
        dueDate: input.dueDate,
        payer,
        nossoNumero,
        description: input.description,
      });
      return prisma.receivable.update({
        where: { id: draft.id },
        data: {
          externalId: result.externalId,
          nossoNumero: result.nossoNumero ?? nossoNumero,
          digitableLine: result.digitableLine ?? null,
          barcode: result.barcode ?? null,
          status: applyDueDateOverdue(result.status, input.dueDate),
          externalStatus: result.externalStatus ?? null,
          lastSyncedAt: new Date(),
        },
      });
    } catch (err) {
      await prisma.receivable.delete({ where: { id: draft.id } }).catch(() => {});
      throw err;
    }
  }

  return prisma.receivable.create({
    data: {
      organizationId: input.organizationId,
      customerId: input.customerId,
      orderId: input.orderId ?? null,
      bankConnectionId: connection.id,
      externalId,
      nossoNumero,
      digitableLine,
      barcode,
      amount: input.amount,
      dueDate: input.dueDate,
      status: applyDueDateOverdue(status, input.dueDate),
      externalStatus,
      lastSyncedAt,
    },
  });
}

export async function applyReceivableStatusUpdate(input: {
  organizationId: string;
  receivableId?: string;
  bankConnectionId?: string;
  externalId?: string | null;
  nossoNumero?: string | null;
  status: ReceivableStatus;
  externalStatus?: string | null;
  paidAmount?: number | null;
  paidAt?: Date | null;
}): Promise<Receivable | null> {
  let row: Receivable | null = null;
  if (input.receivableId) {
    row = await prisma.receivable.findFirst({
      where: { id: input.receivableId, organizationId: input.organizationId },
    });
  } else if (input.externalId && input.bankConnectionId) {
    row = await prisma.receivable.findFirst({
      where: {
        organizationId: input.organizationId,
        bankConnectionId: input.bankConnectionId,
        externalId: input.externalId,
      },
    });
  } else if (input.nossoNumero && input.bankConnectionId) {
    row = await prisma.receivable.findFirst({
      where: {
        organizationId: input.organizationId,
        bankConnectionId: input.bankConnectionId,
        nossoNumero: input.nossoNumero,
      },
    });
  }
  if (!row) return null;

  const paidAmount =
    input.paidAmount != null
      ? roundMoney(input.paidAmount)
      : decToNum(row.paidAmount);
  const status = applyDueDateOverdue(input.status, row.dueDate);
  const paidAt =
    status === "PAID" || status === "PARTIALLY_PAID"
      ? input.paidAt ?? row.paidAt ?? new Date()
      : status === "CANCELLED"
        ? row.paidAt
        : null;

  return prisma.receivable.update({
    where: { id: row.id },
    data: {
      status,
      externalStatus: input.externalStatus ?? row.externalStatus,
      paidAmount,
      paidAt,
      lastSyncedAt: new Date(),
    },
  });
}

/** Consulta API do banco e atualiza o recebível local (fallback ao webhook). */
export async function syncReceivable(
  organizationId: string,
  receivableId: string,
): Promise<Receivable> {
  const row = await prisma.receivable.findFirst({
    where: { id: receivableId, organizationId },
    include: { bankConnection: true },
  });
  if (!row) {
    throw new BankingProviderError("Recebível não encontrado", "VALIDATION", 404);
  }

  const provider = createBankingProvider(row.bankConnection);
  const remote = await provider.getBoleto({
    externalId: row.externalId,
    nossoNumero: row.nossoNumero,
  });
  if (!remote) {
    const refreshed = await prisma.receivable.update({
      where: { id: row.id },
      data: {
        status: applyDueDateOverdue(row.status, row.dueDate),
        lastSyncedAt: new Date(),
      },
    });
    await prisma.bankConnection.update({
      where: { id: row.bankConnectionId },
      data: { lastSyncAt: new Date() },
    });
    return refreshed;
  }

  const updated = await prisma.receivable.update({
    where: { id: row.id },
    data: {
      externalId: remote.externalId || row.externalId,
      nossoNumero: remote.nossoNumero ?? row.nossoNumero,
      digitableLine: remote.digitableLine ?? row.digitableLine,
      barcode: remote.barcode ?? row.barcode,
      status: applyDueDateOverdue(remote.status, row.dueDate),
      externalStatus: remote.externalStatus ?? row.externalStatus,
      lastSyncedAt: new Date(),
      ...(remote.status === "PAID"
        ? {
            paidAmount: row.amount,
            paidAt: new Date(),
          }
        : {}),
    },
  });

  await prisma.bankConnection.update({
    where: { id: row.bankConnectionId },
    data: { lastSyncAt: new Date(), lastError: null },
  });

  return updated;
}

/** Reconciliação leve: marca overdue local + sync opcional dos PENDING recentes. */
export async function reconcileOpenReceivables(input?: {
  organizationId?: string;
  limit?: number;
  syncRemote?: boolean;
}): Promise<{ markedOverdue: number; synced: number; errors: number }> {
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const whereOrg = input?.organizationId
    ? { organizationId: input.organizationId }
    : {};

  const overdueResult = await prisma.receivable.updateMany({
    where: {
      ...whereOrg,
      status: { in: ["PENDING", "PARTIALLY_PAID", "PROCESSING"] },
      dueDate: { lt: today0 },
    },
    data: { status: "OVERDUE" },
  });

  let synced = 0;
  let errors = 0;
  if (input?.syncRemote) {
    const open = await prisma.receivable.findMany({
      where: {
        ...whereOrg,
        status: { in: ["PENDING", "OVERDUE", "PARTIALLY_PAID", "PROCESSING"] },
      },
      orderBy: { dueDate: "asc" },
      take: input.limit ?? 40,
      select: { id: true, organizationId: true },
    });
    for (const r of open) {
      try {
        await syncReceivable(r.organizationId, r.id);
        synced++;
      } catch {
        errors++;
      }
    }
  }

  return { markedOverdue: overdueResult.count, synced, errors };
}

export async function listCustomerReceivables(
  organizationId: string,
  customerId: string,
) {
  return prisma.receivable.findMany({
    where: { organizationId, customerId },
    orderBy: [{ dueDate: "asc" }],
    include: {
      bankConnection: { select: { id: true, provider: true, status: true } },
    },
  });
}

export function serializeReceivable(r: Receivable & {
  bankConnection?: { id: string; provider: BankingProviderKind; status: string };
}) {
  const amount = decToNum(r.amount);
  const paid = decToNum(r.paidAmount);
  return {
    id: r.id,
    customerId: r.customerId,
    orderId: r.orderId,
    bankConnectionId: r.bankConnectionId,
    provider: r.bankConnection?.provider ?? null,
    externalId: r.externalId,
    nossoNumero: r.nossoNumero,
    digitableLine: r.digitableLine,
    barcode: r.barcode,
    amount,
    paidAmount: paid,
    remaining: Math.max(0, roundMoney(amount - paid)),
    dueDate: r.dueDate.toISOString(),
    paidAt: r.paidAt?.toISOString() ?? null,
    status: r.status,
    externalStatus: r.externalStatus,
    lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    installmentIndex: r.installmentIndex,
    installmentTotal: r.installmentTotal,
    pdfUrl: r.pdfUrl,
    instructions: r.instructions,
  };
}
