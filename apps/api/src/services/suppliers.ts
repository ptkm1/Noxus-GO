import { prisma } from "../db.js";
import { validateSupplierFields } from "./supplier-validation.js";

export class SupplierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierError";
  }
}

const supplierSelect = {
  id: true,
  code: true,
  legalName: true,
  cnpj: true,
  tradeName: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listSuppliers(organizationId: string) {
  return prisma.supplier.findMany({
    where: { organizationId },
    select: supplierSelect,
    orderBy: [{ tradeName: "asc" }, { code: "asc" }],
  });
}

export async function getSupplier(organizationId: string, id: string) {
  return prisma.supplier.findFirst({
    where: { id, organizationId },
    select: supplierSelect,
  });
}

export async function createSupplier(
  organizationId: string,
  input: { code: string; legalName: string; cnpj: string; tradeName: string },
) {
  const validated = validateSupplierFields(input);
  if (!validated.ok) throw new SupplierError(validated.error);

  const { code, legalName, cnpj, tradeName } = validated.value;

  const codeTaken = await prisma.supplier.findFirst({
    where: { organizationId, code },
    select: { id: true },
  });
  if (codeTaken) throw new SupplierError("Código de fornecedor já cadastrado.");

  const cnpjTaken = await prisma.supplier.findFirst({
    where: { organizationId, cnpj },
    select: { id: true },
  });
  if (cnpjTaken)
    throw new SupplierError("CNPJ já cadastrado para outro fornecedor.");

  return prisma.supplier.create({
    data: { organizationId, code, legalName, cnpj, tradeName },
    select: supplierSelect,
  });
}

export async function updateSupplier(
  organizationId: string,
  id: string,
  input: {
    code?: string;
    legalName?: string;
    cnpj?: string;
    tradeName?: string;
    active?: boolean;
  },
) {
  const existing = await prisma.supplier.findFirst({
    where: { id, organizationId },
    select: supplierSelect,
  });
  if (!existing) return null;

  const merged = {
    code: input.code ?? existing.code,
    legalName: input.legalName ?? existing.legalName,
    cnpj: input.cnpj ?? existing.cnpj,
    tradeName: input.tradeName ?? existing.tradeName,
  };

  const validated = validateSupplierFields(merged);
  if (!validated.ok) throw new SupplierError(validated.error);

  const { code, legalName, cnpj, tradeName } = validated.value;

  const codeTaken = await prisma.supplier.findFirst({
    where: { organizationId, code, id: { not: id } },
    select: { id: true },
  });
  if (codeTaken) throw new SupplierError("Código de fornecedor já cadastrado.");

  const cnpjTaken = await prisma.supplier.findFirst({
    where: { organizationId, cnpj, id: { not: id } },
    select: { id: true },
  });
  if (cnpjTaken)
    throw new SupplierError("CNPJ já cadastrado para outro fornecedor.");

  return prisma.supplier.update({
    where: { id },
    data: {
      code,
      legalName,
      cnpj,
      tradeName,
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
    select: supplierSelect,
  });
}

export async function deleteSupplier(organizationId: string, id: string) {
  const existing = await prisma.supplier.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) return false;

  const productCount = await prisma.product.count({
    where: { organizationId, supplierId: id },
  });
  if (productCount > 0) {
    throw new SupplierError(
      "Não é possível excluir: existem produtos vinculados a este fornecedor.",
    );
  }

  await prisma.supplier.delete({ where: { id } });
  return true;
}

export async function assertSupplierInOrg(
  organizationId: string,
  supplierId: string,
): Promise<boolean> {
  const row = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId, active: true },
    select: { id: true },
  });
  return !!row;
}
