import type { Prisma } from "@prisma/client";

/**
 * Próximo `code` sequencial de cliente por organização (inteiro).
 * Exige transação: `FOR UPDATE` na Organization para serializar alocações.
 */
export async function nextCustomerCode(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<number> {
  await tx.$executeRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
  const last = await tx.customer.findFirst({
    where: { organizationId, code: { not: null } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  return (last?.code ?? 0) + 1;
}
