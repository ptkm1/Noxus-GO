import type { AccountsPayableStatus, Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { assertSupplierInOrg } from "../suppliers.js";
import {
  assertCostCenterInOrg,
  assertExpenseHistoryInOrg,
  FiscalLookupError,
} from "./fiscal-lookups.js";

export class AccountsPayableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountsPayableError";
  }
}

const apInclude = {
  supplier: {
    select: { id: true, code: true, tradeName: true, legalName: true },
  },
  costCenter: { select: { id: true, code: true, name: true } },
  history: { select: { id: true, code: true, description: true } },
} as const;

function serialize(row: {
  id: string;
  docNumber: string;
  supplierId: string;
  issueDate: Date;
  dueDate: Date;
  competence: Date;
  historyId: string | null;
  costCenterId: string | null;
  amount: Prisma.Decimal;
  notes: string | null;
  status: AccountsPayableStatus;
  createdAt: Date;
  updatedAt: Date;
  supplier: {
    id: string;
    code: string;
    tradeName: string;
    legalName: string;
  };
  costCenter: { id: string; code: string; name: string } | null;
  history: { id: string; code: string; description: string } | null;
}) {
  return {
    id: row.id,
    docNumber: row.docNumber,
    supplierId: row.supplierId,
    issueDate: row.issueDate.toISOString().slice(0, 10),
    dueDate: row.dueDate.toISOString().slice(0, 10),
    competence: row.competence.toISOString().slice(0, 10),
    historyId: row.historyId,
    costCenterId: row.costCenterId,
    amount: Number(row.amount),
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    supplier: row.supplier,
    costCenter: row.costCenter,
    history: row.history,
  };
}

function parseDay(raw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) throw new AccountsPayableError(`Data inválida: ${raw}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function parseCompetence(raw: string): Date {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(raw.trim());
  if (!m) throw new AccountsPayableError(`Competência inválida: ${raw}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
}

export type AccountsPayableInput = {
  docNumber: string;
  supplierId: string;
  issueDate: string;
  dueDate: string;
  competence: string;
  amount: number;
  status?: AccountsPayableStatus;
  historyId?: string | null;
  costCenterId?: string | null;
  notes?: string | null;
};

export async function listAccountsPayable(
  organizationId: string,
  filters: {
    status?: AccountsPayableStatus;
    from?: string;
    to?: string;
    supplierId?: string;
  } = {},
) {
  const where: Prisma.AccountsPayableWhereInput = { organizationId };
  if (filters.status) where.status = filters.status;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  const dueDate: Prisma.DateTimeFilter = {};
  if (filters.from) dueDate.gte = parseDay(filters.from);
  if (filters.to) dueDate.lte = parseDay(filters.to);
  if (Object.keys(dueDate).length) where.dueDate = dueDate;

  const rows = await prisma.accountsPayable.findMany({
    where,
    include: apInclude,
    orderBy: [{ dueDate: "asc" }, { docNumber: "asc" }],
  });
  return rows.map(serialize);
}

async function validateRefs(
  organizationId: string,
  input: {
    supplierId: string;
    costCenterId?: string | null;
    historyId?: string | null;
  },
) {
  const ok = await assertSupplierInOrg(organizationId, input.supplierId);
  if (!ok) throw new AccountsPayableError("Fornecedor inválido.");
  try {
    await assertCostCenterInOrg(organizationId, input.costCenterId);
    await assertExpenseHistoryInOrg(organizationId, input.historyId);
  } catch (e) {
    if (e instanceof FiscalLookupError) {
      throw new AccountsPayableError(e.message);
    }
    throw e;
  }
}

export async function createAccountsPayable(
  organizationId: string,
  input: AccountsPayableInput,
) {
  const docNumber = input.docNumber.trim();
  if (!docNumber) {
    throw new AccountsPayableError("Número / referência obrigatório.");
  }
  if (!(input.amount > 0)) {
    throw new AccountsPayableError("Valor deve ser positivo.");
  }

  await validateRefs(organizationId, input);

  const row = await prisma.accountsPayable.create({
    data: {
      organizationId,
      docNumber,
      supplierId: input.supplierId,
      issueDate: parseDay(input.issueDate),
      dueDate: parseDay(input.dueDate),
      competence: parseCompetence(input.competence),
      historyId: input.historyId ?? null,
      costCenterId: input.costCenterId ?? null,
      amount: input.amount,
      notes: input.notes?.trim() || null,
      status: input.status ?? "AUTHORIZED",
    },
    include: apInclude,
  });
  return serialize(row);
}

export async function updateAccountsPayable(
  organizationId: string,
  id: string,
  input: Partial<AccountsPayableInput>,
) {
  const existing = await prisma.accountsPayable.findFirst({
    where: { id, organizationId },
    select: { id: true, supplierId: true },
  });
  if (!existing) return null;

  if (input.docNumber !== undefined && !input.docNumber.trim()) {
    throw new AccountsPayableError("Número / referência obrigatório.");
  }
  if (input.amount !== undefined && !(input.amount > 0)) {
    throw new AccountsPayableError("Valor deve ser positivo.");
  }

  const supplierId = input.supplierId ?? existing.supplierId;
  await validateRefs(organizationId, {
    supplierId,
    costCenterId: input.costCenterId,
    historyId: input.historyId,
  });

  const row = await prisma.accountsPayable.update({
    where: { id },
    data: {
      ...(input.docNumber !== undefined
        ? { docNumber: input.docNumber.trim() }
        : {}),
      ...(input.supplierId !== undefined
        ? { supplierId: input.supplierId }
        : {}),
      ...(input.issueDate !== undefined
        ? { issueDate: parseDay(input.issueDate) }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: parseDay(input.dueDate) }
        : {}),
      ...(input.competence !== undefined
        ? { competence: parseCompetence(input.competence) }
        : {}),
      ...(input.historyId !== undefined ? { historyId: input.historyId } : {}),
      ...(input.costCenterId !== undefined
        ? { costCenterId: input.costCenterId }
        : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.notes !== undefined
        ? { notes: input.notes?.trim() || null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: apInclude,
  });
  return serialize(row);
}

export async function deleteAccountsPayable(
  organizationId: string,
  id: string,
) {
  const existing = await prisma.accountsPayable.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.accountsPayable.delete({ where: { id } });
  return true;
}
