import type {
  BankingProviderKind,
  Prisma,
  Receivable,
  ReceivableStatus,
} from "@prisma/client";
import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";
import {
  AUDIT_ACTION,
  writeAuditLog,
} from "../audit-log.js";
import type {
  BoletoEditableField,
  CreateBoletoInput,
  UpdateBoletoInput,
} from "./banking-provider.js";
import { BankingProviderError } from "./banking-provider.js";
import { generateInternalBoletoPdf } from "./boleto-pdf.js";
import { applyDueDateOverdue } from "./map-status.js";
import { createBankingProvider } from "./resolve-banking-provider.js";
import {
  serializeReceivable,
  syncReceivable,
} from "./receivable-service.js";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Rateia valor em N parcelas em centavos (última absorve resto). */
export function splitInstallmentAmounts(
  total: number,
  parts: number,
): number[] {
  if (parts <= 1) return [roundMoney(total)];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const amounts: number[] = [];
  let allocated = 0;
  for (let i = 0; i < parts - 1; i++) {
    amounts.push(base / 100);
    allocated += base;
  }
  amounts.push((cents - allocated) / 100);
  return amounts.map(roundMoney);
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function resolveInstallmentDays(pc: {
  days: number;
  installmentDays: number[];
}): number[] {
  if (pc.installmentDays?.length) return pc.installmentDays;
  if (pc.days > 0) return [pc.days];
  return [];
}

async function recordEvent(input: {
  organizationId: string;
  receivableId: string;
  actorUserId?: string | null;
  action: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.receivableEvent.create({
    data: {
      organizationId: input.organizationId,
      receivableId: input.receivableId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      message: input.message,
      metadata: input.metadata ?? undefined,
    },
  });
}

function customerDoc(c: {
  cpf: string | null;
  cnpj: string | null;
}): string {
  return (c.cnpj || c.cpf || "").replace(/\D/g, "");
}

function hasMinDocs(c: {
  name: string;
  cpf: string | null;
  cnpj: string | null;
}): boolean {
  return Boolean(c.name?.trim() && customerDoc(c).length >= 11);
}

export type EligibleOrderForBoleto = {
  id: string;
  orderNumber: number | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    document: string | null;
  } | null;
  paymentCondition: {
    id: string;
    code: string;
    name: string;
    days: number;
    installmentDays: number[];
  } | null;
  openInstallments: number;
  totalInstallments: number;
  alreadyEmitted: number;
  canEmit: boolean;
  issues: string[];
};

export async function listEligibleOrdersForBoletos(
  organizationId: string,
): Promise<EligibleOrderForBoleto[]> {
  const activeBanks = await prisma.bankConnection.findMany({
    where: { organizationId, status: "ACTIVE" },
  });
  const bankReady = activeBanks.some((c) => {
    try {
      return createBankingProvider(c).capabilities().createBoleto;
    } catch {
      return false;
    }
  });

  const orders = await prisma.order.findMany({
    where: {
      organizationId,
      status: "CONFIRMED",
      paymentCondition: {
        OR: [
          { days: { gt: 0 } },
          { installmentDays: { isEmpty: false } },
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          cpf: true,
          cnpj: true,
        },
      },
      paymentCondition: {
        select: {
          id: true,
          code: true,
          name: true,
          days: true,
          installmentDays: true,
        },
      },
      receivables: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true, installmentIndex: true, status: true },
      },
    },
  });

  return orders.map((o) => {
    const days = o.paymentCondition
      ? resolveInstallmentDays(o.paymentCondition)
      : [];
    const totalInstallments = days.length || 1;
    const emitted = o.receivables.length;
    const issues: string[] = [];
    if (!bankReady) issues.push("Nenhuma conexão bancária ACTIVE com createBoleto");
    if (!o.customer || !hasMinDocs(o.customer)) {
      issues.push("Cliente sem nome ou CPF/CNPJ");
    }
    if (!days.length) issues.push("Condição à vista (sem prazo)");
    if (emitted >= totalInstallments) {
      issues.push("Todas as parcelas já emitidas");
    }
    const canEmit = issues.length === 0 && bankReady;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalAmount: decToNum(o.totalAmount),
      createdAt: o.createdAt.toISOString(),
      customer: o.customer
        ? {
            id: o.customer.id,
            name: o.customer.name,
            document: customerDoc(o.customer) || null,
          }
        : null,
      paymentCondition: o.paymentCondition
        ? {
            id: o.paymentCondition.id,
            code: o.paymentCondition.code,
            name: o.paymentCondition.name,
            days: o.paymentCondition.days,
            installmentDays: o.paymentCondition.installmentDays,
          }
        : null,
      openInstallments: Math.max(0, totalInstallments - emitted),
      totalInstallments,
      alreadyEmitted: emitted,
      canEmit,
      issues,
    };
  });
}

export async function getBoletosSummary(organizationId: string) {
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const in7 = new Date(today0);
  in7.setDate(in7.getDate() + 7);

  const [open, overdue, paidMonth, processing, errors, dueSoon] =
    await Promise.all([
      prisma.receivable.count({
        where: {
          organizationId,
          status: { in: ["PENDING", "PARTIALLY_PAID", "PROCESSING"] },
        },
      }),
      prisma.receivable.count({
        where: { organizationId, status: "OVERDUE" },
      }),
      prisma.receivable.count({
        where: {
          organizationId,
          status: "PAID",
          paidAt: {
            gte: new Date(today0.getFullYear(), today0.getMonth(), 1),
          },
        },
      }),
      prisma.receivable.count({
        where: { organizationId, status: "PROCESSING" },
      }),
      prisma.receivable.count({
        where: { organizationId, status: "ERROR" },
      }),
      prisma.receivable.count({
        where: {
          organizationId,
          status: { in: ["PENDING", "PARTIALLY_PAID"] },
          dueDate: { gte: today0, lte: in7 },
        },
      }),
    ]);

  const openSum = await prisma.receivable.aggregate({
    where: {
      organizationId,
      status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE", "PROCESSING"] },
    },
    _sum: { amount: true, paidAmount: true },
  });
  const totalOpen = roundMoney(
    decToNum(openSum._sum.amount) - decToNum(openSum._sum.paidAmount),
  );

  return {
    open,
    overdue,
    paidMonth,
    processing,
    errors,
    dueSoon,
    totalOpenAmount: totalOpen,
  };
}

export type ListBoletosQuery = {
  status?: ReceivableStatus;
  customerId?: string;
  orderId?: string;
  q?: string;
  take?: number;
};

export async function listBoletos(
  organizationId: string,
  query: ListBoletosQuery = {},
) {
  const take = Math.min(query.take ?? 100, 300);
  const where: Prisma.ReceivableWhereInput = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.orderId ? { orderId: query.orderId } : {}),
  };
  if (query.q?.trim()) {
    const q = query.q.trim();
    where.OR = [
      { digitableLine: { contains: q, mode: "insensitive" } },
      { nossoNumero: { contains: q, mode: "insensitive" } },
      { externalId: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.receivable.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take,
    include: {
      bankConnection: {
        select: { id: true, provider: true, status: true },
      },
      customer: { select: { id: true, name: true, cpf: true, cnpj: true } },
      order: { select: { id: true, orderNumber: true } },
    },
  });

  return rows.map((r) => serializeBoletoDetail(r));
}

export function serializeBoletoDetail(
  r: Receivable & {
    bankConnection?: {
      id: string;
      provider: BankingProviderKind;
      status: string;
    };
    customer?: {
      id: string;
      name: string;
      cpf?: string | null;
      cnpj?: string | null;
    };
    order?: { id: string; orderNumber: number | null } | null;
  },
) {
  const base = serializeReceivable(r);
  const caps = r.bankConnection
    ? (() => {
        try {
          // capabilities sem secrets completos — só para UI; provider real na mutação
          return createBankingProvider({
            provider: r.bankConnection!.provider,
            metadata: {},
            credentialsEncrypted: null,
            credentialsEnvPrefix: null,
          }).capabilities();
        } catch {
          return null;
        }
      })()
    : null;

  return {
    ...base,
    barcode: r.barcode,
    installmentIndex: r.installmentIndex,
    installmentTotal: r.installmentTotal,
    pdfUrl: r.pdfUrl,
    instructions: r.instructions,
    interestPercent:
      r.interestPercent != null ? decToNum(r.interestPercent) : null,
    finePercent: r.finePercent != null ? decToNum(r.finePercent) : null,
    discountAmount:
      r.discountAmount != null ? decToNum(r.discountAmount) : null,
    discountUntil: r.discountUntil?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    cancelReason: r.cancelReason,
    customerName: r.customer?.name ?? null,
    customerDocument: r.customer
      ? customerDoc({
          cpf: r.customer.cpf ?? null,
          cnpj: r.customer.cnpj ?? null,
        }) || null
      : null,
    orderNumber: r.order?.orderNumber ?? null,
    editableFields: [] as BoletoEditableField[],
    providerCapabilities: caps
      ? {
          updateBoleto: caps.updateBoleto,
          cancelBoleto: caps.cancelBoleto,
          pdf: caps.pdf,
          editableFields: caps.editableFields,
        }
      : null,
  };
}

export async function getBoletoDetail(
  organizationId: string,
  id: string,
) {
  const row = await prisma.receivable.findFirst({
    where: { id, organizationId },
    include: {
      bankConnection: true,
      customer: {
        select: {
          id: true,
          name: true,
          cpf: true,
          cnpj: true,
          email: true,
        },
      },
      order: { select: { id: true, orderNumber: true } },
      events: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          actorUser: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!row) return null;

  let editableFields: BoletoEditableField[] = [];
  try {
    editableFields = createBankingProvider(row.bankConnection).capabilities()
      .editableFields;
  } catch {
    editableFields = [];
  }

  const detail = serializeBoletoDetail(row);
  return {
    ...detail,
    editableFields,
    events: row.events.map((e) => ({
      id: e.id,
      action: e.action,
      message: e.message,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
      actorUser: e.actorUser
        ? { id: e.actorUser.id, name: e.actorUser.name }
        : null,
    })),
  };
}

type EmitContext = {
  organizationId: string;
  actorUserId?: string | null;
  bankConnectionId: string;
  orderId: string;
  /** Se definido, emite só essa parcela (1-based). Senão todas pendentes. */
  installmentIndex?: number;
  instructions?: string | null;
  interestPercent?: number | null;
  finePercent?: number | null;
  /** Reemissão pode registrar o novo vencimento diretamente no banco. */
  dueDateOverride?: Date;
};

export type EmitBoletoResult = {
  receivables: ReturnType<typeof serializeBoletoDetail>[];
  openPdfIds: string[];
};

async function loadOrderForEmit(organizationId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId, status: "CONFIRMED" },
    include: {
      customer: true,
      paymentCondition: true,
      receivables: {
        where: { status: { not: "CANCELLED" } },
        select: { installmentIndex: true },
      },
    },
  });
  if (!order) {
    throw new BankingProviderError(
      "Pedido não encontrado ou não confirmado",
      "VALIDATION",
      404,
    );
  }
  if (!order.customer || !hasMinDocs(order.customer)) {
    throw new BankingProviderError(
      "Cliente sem nome ou CPF/CNPJ para emitir boleto",
      "VALIDATION",
      400,
    );
  }
  if (!order.paymentCondition) {
    throw new BankingProviderError(
      "Pedido sem condição de pagamento",
      "VALIDATION",
      400,
    );
  }
  const days = resolveInstallmentDays(order.paymentCondition);
  if (!days.length) {
    throw new BankingProviderError(
      "Condição à vista — não há boleto a emitir",
      "VALIDATION",
      400,
    );
  }
  return { order, days };
}

export async function emitBoletosForOrder(
  input: EmitContext,
): Promise<EmitBoletoResult> {
  const connection = await prisma.bankConnection.findFirst({
    where: {
      id: input.bankConnectionId,
      organizationId: input.organizationId,
      status: "ACTIVE",
    },
  });
  if (!connection) {
    throw new BankingProviderError(
      "Conexão bancária não encontrada ou inativa",
      "VALIDATION",
      404,
    );
  }
  const provider = createBankingProvider(connection);
  if (!provider.capabilities().createBoleto) {
    throw new BankingProviderError(
      "Provedor sem capacidade createBoleto (credenciais/homologação)",
      "NOT_CONFIGURED",
      503,
    );
  }

  const { order, days } = await loadOrderForEmit(
    input.organizationId,
    input.orderId,
  );
  const total = decToNum(order.totalAmount);
  const amounts = splitInstallmentAmounts(total, days.length);
  const existingIndexes = new Set(
    order.receivables
      .map((r) => r.installmentIndex)
      .filter((i): i is number => i != null),
  );

  const indexesToEmit: number[] = [];
  if (input.installmentIndex != null) {
    if (
      input.installmentIndex < 1 ||
      input.installmentIndex > days.length
    ) {
      throw new BankingProviderError("Parcela inválida", "VALIDATION", 400);
    }
    if (existingIndexes.has(input.installmentIndex)) {
      throw new BankingProviderError(
        `Parcela ${input.installmentIndex} já emitida`,
        "DUPLICATE",
        409,
      );
    }
    indexesToEmit.push(input.installmentIndex);
  } else {
    for (let i = 1; i <= days.length; i++) {
      if (!existingIndexes.has(i)) indexesToEmit.push(i);
    }
  }
  if (!indexesToEmit.length) {
    throw new BankingProviderError(
      "Nenhuma parcela pendente para emitir",
      "DUPLICATE",
      409,
    );
  }

  const payer: CreateBoletoInput["payer"] = {
    name: order.customer!.name,
    document: customerDoc(order.customer!),
    email: order.customer!.email,
    address: {
      street: order.customer!.street,
      number: order.customer!.number,
      neighborhood: order.customer!.neighborhood,
      city: order.customer!.city,
      state: order.customer!.state,
      postalCode: order.customer!.cep,
    },
  };

  const issued: Receivable[] = [];
  const openPdfIds: string[] = [];
  const baseDate = order.createdAt;
  const customerId = order.customerId;
  if (!customerId) {
    throw new BankingProviderError(
      "Pedido sem cliente",
      "VALIDATION",
      400,
    );
  }

  for (const idx of indexesToEmit) {
    const amount = amounts[idx - 1]!;
    const dueDate = input.dueDateOverride ?? addDays(baseDate, days[idx - 1]!);
    const draft = await prisma.receivable.create({
      data: {
        organizationId: input.organizationId,
        customerId,
        orderId: order.id,
        bankConnectionId: connection.id,
        amount,
        dueDate,
        status: "PROCESSING",
        installmentIndex: idx,
        installmentTotal: days.length,
        instructions: input.instructions ?? null,
        interestPercent: input.interestPercent ?? null,
        finePercent: input.finePercent ?? null,
      },
    });

    try {
      const result = await provider.createBoleto({
        externalReference: draft.id,
        amount,
        dueDate,
        payer,
        description: `Pedido ${order.orderNumber ?? order.id} · parcela ${idx}/${days.length}`,
        instructions: input.instructions,
        interestPercent: input.interestPercent,
        finePercent: input.finePercent,
      });
      const updated = await prisma.receivable.update({
        where: { id: draft.id },
        data: {
          externalId: result.externalId,
          nossoNumero: result.nossoNumero ?? null,
          digitableLine: result.digitableLine ?? null,
          barcode: result.barcode ?? null,
          pdfUrl: result.pdfUrl ?? null,
          status: applyDueDateOverdue(result.status, dueDate),
          externalStatus: result.externalStatus ?? null,
          lastSyncedAt: new Date(),
        },
        include: {
          bankConnection: {
            select: { id: true, provider: true, status: true },
          },
          customer: {
            select: { id: true, name: true, cpf: true, cnpj: true },
          },
          order: { select: { id: true, orderNumber: true } },
        },
      });
      await recordEvent({
        organizationId: input.organizationId,
        receivableId: draft.id,
        actorUserId: input.actorUserId,
        action: "EMIT",
        message: `Boleto emitido (parcela ${idx}/${days.length})`,
        metadata: {
          externalId: result.externalId,
          provider: connection.provider,
        },
      });
      await writeAuditLog({
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: AUDIT_ACTION.CREATE,
        entityType: "Receivable",
        entityId: draft.id,
        metadata: { action: "EMIT_BOLETO", installmentIndex: idx },
      });
      issued.push(updated);
      openPdfIds.push(updated.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na emissão";
      await prisma.receivable.update({
        where: { id: draft.id },
        data: { status: "ERROR", externalStatus: msg.slice(0, 200) },
      });
      await recordEvent({
        organizationId: input.organizationId,
        receivableId: draft.id,
        actorUserId: input.actorUserId,
        action: "EMIT",
        message: `Erro na emissão: ${msg.slice(0, 300)}`,
      });
      throw err;
    }
  }

  return {
    receivables: issued.map((r) =>
      serializeBoletoDetail(
        r as Receivable & {
          bankConnection?: {
            id: string;
            provider: BankingProviderKind;
            status: string;
          };
          customer?: {
            id: string;
            name: string;
            cpf?: string | null;
            cnpj?: string | null;
          };
          order?: { id: string; orderNumber: number | null } | null;
        },
      ),
    ),
    openPdfIds,
  };
}

export async function emitAllPendingBoletos(input: {
  organizationId: string;
  actorUserId?: string | null;
  bankConnectionId: string;
  orderIds?: string[];
}): Promise<{
  results: Array<{
    orderId: string;
    ok: boolean;
    error?: string;
    openPdfIds: string[];
  }>;
}> {
  const eligible = await listEligibleOrdersForBoletos(input.organizationId);
  const targets = eligible.filter(
    (o) =>
      o.canEmit &&
      (!input.orderIds?.length || input.orderIds.includes(o.id)),
  );
  const results: Array<{
    orderId: string;
    ok: boolean;
    error?: string;
    openPdfIds: string[];
  }> = [];

  for (const o of targets) {
    try {
      const r = await emitBoletosForOrder({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        bankConnectionId: input.bankConnectionId,
        orderId: o.id,
      });
      results.push({
        orderId: o.id,
        ok: true,
        openPdfIds: r.openPdfIds,
      });
    } catch (err) {
      results.push({
        orderId: o.id,
        ok: false,
        error: err instanceof Error ? err.message : "Erro",
        openPdfIds: [],
      });
    }
  }
  return { results };
}

export async function patchBoleto(input: {
  organizationId: string;
  receivableId: string;
  actorUserId?: string | null;
  patch: {
    dueDate?: Date;
    amount?: number;
    instructions?: string | null;
    interestPercent?: number | null;
    finePercent?: number | null;
    discountAmount?: number | null;
    discountUntil?: Date | null;
  };
}) {
  const row = await prisma.receivable.findFirst({
    where: { id: input.receivableId, organizationId: input.organizationId },
    include: { bankConnection: true },
  });
  if (!row) {
    throw new BankingProviderError("Boleto não encontrado", "VALIDATION", 404);
  }
  if (row.status === "CANCELLED" || row.status === "PAID") {
    throw new BankingProviderError(
      "Boleto pago ou cancelado não pode ser editado",
      "VALIDATION",
      400,
    );
  }

  const provider = createBankingProvider(row.bankConnection);
  const caps = provider.capabilities();
  if (!caps.updateBoleto || !provider.updateBoleto) {
    throw new BankingProviderError(
      "Provedor não permite edição de boleto",
      "UNSUPPORTED",
      400,
    );
  }
  if (!row.externalId) {
    throw new BankingProviderError(
      "Boleto sem externalId no banco",
      "VALIDATION",
      400,
    );
  }

  const allowed = new Set(caps.editableFields);
  const remote: UpdateBoletoInput = { externalId: row.externalId };
  const localData: Prisma.ReceivableUpdateInput = {};

  for (const [field, value] of Object.entries(input.patch) as Array<
    [BoletoEditableField | string, unknown]
  >) {
    if (value === undefined) continue;
    if (!allowed.has(field as BoletoEditableField)) {
      throw new BankingProviderError(
        `Campo não editável neste banco: ${field}`,
        "UNSUPPORTED",
        400,
      );
    }
    (remote as Record<string, unknown>)[field] = value;
    (localData as Record<string, unknown>)[field] = value;
  }

  const result = await provider.updateBoleto(remote);
  const updated = await prisma.receivable.update({
    where: { id: row.id },
    data: {
      ...localData,
      status: applyDueDateOverdue(result.status, input.patch.dueDate ?? row.dueDate),
      externalStatus: result.externalStatus ?? row.externalStatus,
      digitableLine: result.digitableLine ?? row.digitableLine,
      barcode: result.barcode ?? row.barcode,
      lastSyncedAt: new Date(),
    },
    include: {
      bankConnection: {
        select: { id: true, provider: true, status: true },
      },
      customer: { select: { id: true, name: true, cpf: true, cnpj: true } },
      order: { select: { id: true, orderNumber: true } },
    },
  });

  await recordEvent({
    organizationId: input.organizationId,
    receivableId: row.id,
    actorUserId: input.actorUserId,
    action: "UPDATE",
    message: "Boleto atualizado no banco",
    metadata: input.patch as Prisma.InputJsonValue,
  });
  await writeAuditLog({
    organizationId: input.organizationId,
    userId: input.actorUserId,
    action: AUDIT_ACTION.UPDATE,
    entityType: "Receivable",
    entityId: row.id,
    metadata: { action: "UPDATE_BOLETO" },
  });

  return {
    boleto: serializeBoletoDetail(updated),
    openPdf: true as const,
  };
}

export async function cancelBoleto(input: {
  organizationId: string;
  receivableId: string;
  actorUserId?: string | null;
  reason?: string;
}) {
  const row = await prisma.receivable.findFirst({
    where: { id: input.receivableId, organizationId: input.organizationId },
    include: { bankConnection: true },
  });
  if (!row) {
    throw new BankingProviderError("Boleto não encontrado", "VALIDATION", 404);
  }
  if (row.status === "CANCELLED") {
    throw new BankingProviderError("Boleto já cancelado", "VALIDATION", 400);
  }
  if (row.status === "PAID") {
    throw new BankingProviderError(
      "Boleto pago não pode ser cancelado",
      "VALIDATION",
      400,
    );
  }

  const provider = createBankingProvider(row.bankConnection);
  if (row.externalId && provider.cancelBoleto) {
    await provider.cancelBoleto({
      externalId: row.externalId,
      reason: input.reason,
    });
  }

  const updated = await prisma.receivable.update({
    where: { id: row.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByUserId: input.actorUserId ?? null,
      cancelReason: input.reason?.slice(0, 500) ?? null,
      lastSyncedAt: new Date(),
    },
    include: {
      bankConnection: {
        select: { id: true, provider: true, status: true },
      },
      customer: { select: { id: true, name: true, cpf: true, cnpj: true } },
      order: { select: { id: true, orderNumber: true } },
    },
  });

  await recordEvent({
    organizationId: input.organizationId,
    receivableId: row.id,
    actorUserId: input.actorUserId,
    action: "CANCEL",
    message: input.reason?.slice(0, 300) || "Boleto cancelado",
  });
  await writeAuditLog({
    organizationId: input.organizationId,
    userId: input.actorUserId,
    action: AUDIT_ACTION.STATUS_CHANGE,
    entityType: "Receivable",
    entityId: row.id,
    metadata: { action: "CANCEL_BOLETO", reason: input.reason ?? null },
  });

  return serializeBoletoDetail(updated);
}

export async function reissueBoleto(input: {
  organizationId: string;
  receivableId: string;
  actorUserId?: string | null;
  bankConnectionId?: string;
  dueDate?: Date;
}) {
  const row = await prisma.receivable.findFirst({
    where: { id: input.receivableId, organizationId: input.organizationId },
    include: { bankConnection: true },
  });
  if (!row) {
    throw new BankingProviderError("Boleto não encontrado", "VALIDATION", 404);
  }
  if (!row.orderId) {
    throw new BankingProviderError(
      "Reemissão exige boleto vinculado a pedido",
      "VALIDATION",
      400,
    );
  }

  if (row.status !== "CANCELLED" && row.status !== "ERROR") {
    await cancelBoleto({
      organizationId: input.organizationId,
      receivableId: row.id,
      actorUserId: input.actorUserId,
      reason: "Cancelado para reemissão",
    });
  }

  const result = await emitBoletosForOrder({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    bankConnectionId: input.bankConnectionId ?? row.bankConnectionId,
    orderId: row.orderId,
    installmentIndex: row.installmentIndex ?? 1,
    instructions: row.instructions,
    interestPercent:
      row.interestPercent != null ? decToNum(row.interestPercent) : null,
    finePercent: row.finePercent != null ? decToNum(row.finePercent) : null,
    dueDateOverride: input.dueDate,
  });

  for (const id of result.openPdfIds) {
    await recordEvent({
      organizationId: input.organizationId,
      receivableId: id,
      actorUserId: input.actorUserId,
      action: "REISSUE",
      message: `Reemitido a partir de ${row.id}`,
      metadata: { previousId: row.id },
    });
  }

  return result;
}

export async function syncBoletoWithEvent(input: {
  organizationId: string;
  receivableId: string;
  actorUserId?: string | null;
}) {
  const updated = await syncReceivable(
    input.organizationId,
    input.receivableId,
  );
  await recordEvent({
    organizationId: input.organizationId,
    receivableId: input.receivableId,
    actorUserId: input.actorUserId,
    action: "SYNC",
    message: `Status sincronizado: ${updated.status}`,
    metadata: { status: updated.status, externalStatus: updated.externalStatus },
  });
  const detail = await getBoletoDetail(
    input.organizationId,
    input.receivableId,
  );
  return detail!;
}

export async function getBoletoPdfBuffer(input: {
  organizationId: string;
  receivableId: string;
  actorUserId?: string | null;
  action?: "PDF_VIEW" | "PDF_DOWNLOAD";
}): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const row = await prisma.receivable.findFirst({
    where: { id: input.receivableId, organizationId: input.organizationId },
    include: {
      bankConnection: true,
      customer: true,
      order: { select: { orderNumber: true } },
      organization: { select: { name: true, displayName: true, cnpj: true, document: true } },
    },
  });
  if (!row) {
    throw new BankingProviderError("Boleto não encontrado", "VALIDATION", 404);
  }

  const provider = createBankingProvider(row.bankConnection);
  if (provider.getBoletoPdf) {
    try {
      const remote = await provider.getBoletoPdf({
        externalId: row.externalId,
        nossoNumero: row.nossoNumero,
      });
      if (remote?.kind === "buffer") {
        await recordEvent({
          organizationId: input.organizationId,
          receivableId: row.id,
          actorUserId: input.actorUserId,
          action: input.action ?? "PDF_VIEW",
          message: "PDF obtido do banco",
        });
        return {
          buffer: remote.data,
          contentType: remote.contentType ?? "application/pdf",
          filename: `boleto-${row.id}.pdf`,
        };
      }
      if (remote?.kind === "url") {
        const res = await fetch(remote.url);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          await recordEvent({
            organizationId: input.organizationId,
            receivableId: row.id,
            actorUserId: input.actorUserId,
            action: input.action ?? "PDF_VIEW",
            message: "PDF baixado da URL do banco",
          });
          return {
            buffer: buf,
            contentType: "application/pdf",
            filename: `boleto-${row.id}.pdf`,
          };
        }
      }
    } catch {
      // fallback interno
    }
  }

  const buffer = await generateInternalBoletoPdf({
    organizationName:
      row.organization.displayName || row.organization.name,
    organizationDocument:
      row.organization.cnpj || row.organization.document,
    payerName: row.customer.name,
    payerDocument: customerDoc(row.customer),
    amount: decToNum(row.amount),
    dueDate: row.dueDate,
    digitableLine: row.digitableLine,
    barcode: row.barcode,
    nossoNumero: row.nossoNumero,
    instructions: row.instructions,
    installmentIndex: row.installmentIndex,
    installmentTotal: row.installmentTotal,
    orderLabel: row.order?.orderNumber
      ? String(row.order.orderNumber)
      : row.orderId,
  });

  await recordEvent({
    organizationId: input.organizationId,
    receivableId: row.id,
    actorUserId: input.actorUserId,
    action: input.action ?? "PDF_VIEW",
    message: "PDF interno gerado",
  });

  return {
    buffer,
    contentType: "application/pdf",
    filename: `boleto-${row.id}.pdf`,
  };
}
