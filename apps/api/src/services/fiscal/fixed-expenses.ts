import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { assertSupplierInOrg } from "../suppliers.js";
import {
  assertCostCenterInOrg,
  assertExpenseHistoryInOrg,
  FiscalLookupError,
} from "./fiscal-lookups.js";

export class FixedExpenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FixedExpenseError";
  }
}

const fixedExpenseInclude = {
  supplier: {
    select: { id: true, code: true, tradeName: true },
  },
  costCenter: { select: { id: true, code: true, name: true } },
  history: { select: { id: true, code: true, description: true } },
} as const;

function serialize(row: {
  id: string;
  name: string;
  supplierId: string | null;
  costCenterId: string | null;
  historyId: string | null;
  amount: Prisma.Decimal;
  dayOfMonth: number;
  active: boolean;
  notes: string | null;
  competenceLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier: { id: string; code: string; tradeName: string } | null;
  costCenter: { id: string; code: string; name: string } | null;
  history: { id: string; code: string; description: string } | null;
}) {
  return {
    id: row.id,
    name: row.name,
    supplierId: row.supplierId,
    costCenterId: row.costCenterId,
    historyId: row.historyId,
    amount: Number(row.amount),
    dayOfMonth: row.dayOfMonth,
    active: row.active,
    notes: row.notes,
    competenceLabel: row.competenceLabel,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    supplier: row.supplier,
    costCenter: row.costCenter,
    history: row.history,
  };
}

export async function listFixedExpenses(organizationId: string) {
  const rows = await prisma.operationalFixedExpense.findMany({
    where: { organizationId },
    include: fixedExpenseInclude,
    orderBy: [{ name: "asc" }],
  });
  return rows.map(serialize);
}

export async function createFixedExpense(
  organizationId: string,
  input: {
    name: string;
    amount: number;
    dayOfMonth: number;
    supplierId?: string | null;
    costCenterId?: string | null;
    historyId?: string | null;
    notes?: string | null;
    competenceLabel?: string | null;
    active?: boolean;
  },
) {
  const name = input.name.trim();
  if (!name) throw new FixedExpenseError("Nome obrigatório.");
  if (!(input.amount > 0))
    throw new FixedExpenseError("Valor deve ser positivo.");
  if (input.dayOfMonth < 1 || input.dayOfMonth > 28) {
    throw new FixedExpenseError("Dia do mês deve ser entre 1 e 28.");
  }

  if (input.supplierId) {
    const ok = await assertSupplierInOrg(organizationId, input.supplierId);
    if (!ok) throw new FixedExpenseError("Fornecedor inválido.");
  }
  try {
    await assertCostCenterInOrg(organizationId, input.costCenterId);
    await assertExpenseHistoryInOrg(organizationId, input.historyId);
  } catch (e) {
    if (e instanceof FiscalLookupError) throw new FixedExpenseError(e.message);
    throw e;
  }

  const row = await prisma.operationalFixedExpense.create({
    data: {
      organizationId,
      name,
      amount: input.amount,
      dayOfMonth: input.dayOfMonth,
      supplierId: input.supplierId ?? null,
      costCenterId: input.costCenterId ?? null,
      historyId: input.historyId ?? null,
      notes: input.notes?.trim() || null,
      competenceLabel: input.competenceLabel?.trim() || null,
      active: input.active ?? true,
    },
    include: fixedExpenseInclude,
  });
  return serialize(row);
}

export async function updateFixedExpense(
  organizationId: string,
  id: string,
  input: {
    name?: string;
    amount?: number;
    dayOfMonth?: number;
    supplierId?: string | null;
    costCenterId?: string | null;
    historyId?: string | null;
    notes?: string | null;
    competenceLabel?: string | null;
    active?: boolean;
  },
) {
  const existing = await prisma.operationalFixedExpense.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) return null;

  if (input.name !== undefined && !input.name.trim()) {
    throw new FixedExpenseError("Nome obrigatório.");
  }
  if (input.amount !== undefined && !(input.amount > 0)) {
    throw new FixedExpenseError("Valor deve ser positivo.");
  }
  if (
    input.dayOfMonth !== undefined &&
    (input.dayOfMonth < 1 || input.dayOfMonth > 28)
  ) {
    throw new FixedExpenseError("Dia do mês deve ser entre 1 e 28.");
  }

  if (input.supplierId) {
    const ok = await assertSupplierInOrg(organizationId, input.supplierId);
    if (!ok) throw new FixedExpenseError("Fornecedor inválido.");
  }
  try {
    if (input.costCenterId !== undefined) {
      await assertCostCenterInOrg(organizationId, input.costCenterId);
    }
    if (input.historyId !== undefined) {
      await assertExpenseHistoryInOrg(organizationId, input.historyId);
    }
  } catch (e) {
    if (e instanceof FiscalLookupError) throw new FixedExpenseError(e.message);
    throw e;
  }

  const row = await prisma.operationalFixedExpense.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.dayOfMonth !== undefined
        ? { dayOfMonth: input.dayOfMonth }
        : {}),
      ...(input.supplierId !== undefined
        ? { supplierId: input.supplierId }
        : {}),
      ...(input.costCenterId !== undefined
        ? { costCenterId: input.costCenterId }
        : {}),
      ...(input.historyId !== undefined ? { historyId: input.historyId } : {}),
      ...(input.notes !== undefined
        ? { notes: input.notes?.trim() || null }
        : {}),
      ...(input.competenceLabel !== undefined
        ? { competenceLabel: input.competenceLabel?.trim() || null }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
    include: fixedExpenseInclude,
  });
  return serialize(row);
}

export async function deleteFixedExpense(organizationId: string, id: string) {
  const existing = await prisma.operationalFixedExpense.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.operationalFixedExpense.delete({ where: { id } });
  return true;
}
