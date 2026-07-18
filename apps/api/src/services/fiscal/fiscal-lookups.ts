import { prisma } from "../../db.js";

export class FiscalLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalLookupError";
  }
}

const costCenterSelect = {
  id: true,
  code: true,
  name: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

const expenseHistorySelect = {
  id: true,
  code: true,
  description: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

export async function listCostCenters(organizationId: string) {
  return prisma.costCenter.findMany({
    where: { organizationId },
    select: costCenterSelect,
    orderBy: [{ code: "asc" }],
  });
}

export async function createCostCenter(
  organizationId: string,
  input: { code: string; name: string },
) {
  const code = normalizeCode(input.code);
  const name = input.name.trim();
  if (!code) throw new FiscalLookupError("Código obrigatório.");
  if (!name) throw new FiscalLookupError("Nome obrigatório.");

  const taken = await prisma.costCenter.findFirst({
    where: { organizationId, code },
    select: { id: true },
  });
  if (taken)
    throw new FiscalLookupError("Código de centro de custo já existe.");

  return prisma.costCenter.create({
    data: { organizationId, code, name },
    select: costCenterSelect,
  });
}

export async function updateCostCenter(
  organizationId: string,
  id: string,
  input: { code?: string; name?: string; active?: boolean },
) {
  const existing = await prisma.costCenter.findFirst({
    where: { id, organizationId },
    select: costCenterSelect,
  });
  if (!existing) return null;

  const code =
    input.code !== undefined ? normalizeCode(input.code) : existing.code;
  const name = input.name !== undefined ? input.name.trim() : existing.name;
  if (!code) throw new FiscalLookupError("Código obrigatório.");
  if (!name) throw new FiscalLookupError("Nome obrigatório.");

  const taken = await prisma.costCenter.findFirst({
    where: { organizationId, code, id: { not: id } },
    select: { id: true },
  });
  if (taken)
    throw new FiscalLookupError("Código de centro de custo já existe.");

  return prisma.costCenter.update({
    where: { id },
    data: {
      code,
      name,
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
    select: costCenterSelect,
  });
}

export async function deleteCostCenter(organizationId: string, id: string) {
  const existing = await prisma.costCenter.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.costCenter.delete({ where: { id } });
  return true;
}

export async function listExpenseHistories(organizationId: string) {
  return prisma.expenseHistory.findMany({
    where: { organizationId },
    select: expenseHistorySelect,
    orderBy: [{ code: "asc" }],
  });
}

export async function createExpenseHistory(
  organizationId: string,
  input: { code: string; description: string },
) {
  const code = normalizeCode(input.code);
  const description = input.description.trim();
  if (!code) throw new FiscalLookupError("Código obrigatório.");
  if (!description) throw new FiscalLookupError("Descrição obrigatória.");

  const taken = await prisma.expenseHistory.findFirst({
    where: { organizationId, code },
    select: { id: true },
  });
  if (taken) throw new FiscalLookupError("Código de histórico já existe.");

  return prisma.expenseHistory.create({
    data: { organizationId, code, description },
    select: expenseHistorySelect,
  });
}

export async function updateExpenseHistory(
  organizationId: string,
  id: string,
  input: { code?: string; description?: string; active?: boolean },
) {
  const existing = await prisma.expenseHistory.findFirst({
    where: { id, organizationId },
    select: expenseHistorySelect,
  });
  if (!existing) return null;

  const code =
    input.code !== undefined ? normalizeCode(input.code) : existing.code;
  const description =
    input.description !== undefined
      ? input.description.trim()
      : existing.description;
  if (!code) throw new FiscalLookupError("Código obrigatório.");
  if (!description) throw new FiscalLookupError("Descrição obrigatória.");

  const taken = await prisma.expenseHistory.findFirst({
    where: { organizationId, code, id: { not: id } },
    select: { id: true },
  });
  if (taken) throw new FiscalLookupError("Código de histórico já existe.");

  return prisma.expenseHistory.update({
    where: { id },
    data: {
      code,
      description,
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
    select: expenseHistorySelect,
  });
}

export async function deleteExpenseHistory(organizationId: string, id: string) {
  const existing = await prisma.expenseHistory.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.expenseHistory.delete({ where: { id } });
  return true;
}

export async function assertCostCenterInOrg(
  organizationId: string,
  id: string | null | undefined,
) {
  if (!id) return;
  const row = await prisma.costCenter.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!row) throw new FiscalLookupError("Centro de custo inválido.");
}

export async function assertExpenseHistoryInOrg(
  organizationId: string,
  id: string | null | undefined,
) {
  if (!id) return;
  const row = await prisma.expenseHistory.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!row) throw new FiscalLookupError("Histórico inválido.");
}
