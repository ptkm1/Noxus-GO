import { prisma } from "../db.js";

/** Situações padrão criadas na primeira listagem de cada organização. */
export const DEFAULT_ORDER_SITUATIONS = [
  { code: "OPEN", name: "Aberto", sortOrder: 1, mapsToCancel: false },
  { code: "SENT", name: "Enviado", sortOrder: 2, mapsToCancel: false },
  { code: "DELIVERED", name: "Entregue", sortOrder: 3, mapsToCancel: false },
  {
    code: "CANCELLED",
    name: "Cancelado",
    sortOrder: 4,
    mapsToCancel: true,
  },
] as const;

export async function ensureDefaultOrderSituations(
  organizationId: string,
): Promise<void> {
  const count = await prisma.orderSituation.count({
    where: { organizationId },
  });
  if (count > 0) return;

  await prisma.orderSituation.createMany({
    data: DEFAULT_ORDER_SITUATIONS.map((d) => ({
      organizationId,
      code: d.code,
      name: d.name,
      sortOrder: d.sortOrder,
      mapsToCancel: d.mapsToCancel,
      isSystem: true,
      active: true,
    })),
    skipDuplicates: true,
  });
}

export function normalizeSituationCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}
