import type { Prisma } from "@prisma/client";

/**
 * Próximo `orderNumber` sequencial por organização.
 * Exige transação: faz `FOR UPDATE` na Organization para serializar alocações.
 */
export async function nextOrderNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<number> {
  await tx.$executeRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
  const last = await tx.order.findFirst({
    where: { organizationId, orderNumber: { not: null } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  return (last?.orderNumber ?? 0) + 1;
}
