import { prisma } from "../db.js";

/** Situações padrão (sistema). PICKING/PACKED entram na expedição. */
export const DEFAULT_ORDER_SITUATIONS = [
  { code: "OPEN", name: "Aberto", sortOrder: 1, mapsToCancel: false },
  { code: "PICKING", name: "Em separação", sortOrder: 2, mapsToCancel: false },
  { code: "PACKED", name: "Separado", sortOrder: 3, mapsToCancel: false },
  { code: "SENT", name: "Enviado", sortOrder: 4, mapsToCancel: false },
  { code: "DELIVERED", name: "Entregue", sortOrder: 5, mapsToCancel: false },
  {
    code: "CANCELLED",
    name: "Cancelado",
    sortOrder: 6,
    mapsToCancel: true,
  },
] as const;

export async function ensureDefaultOrderSituations(
  organizationId: string,
): Promise<void> {
  for (const d of DEFAULT_ORDER_SITUATIONS) {
    await prisma.orderSituation.upsert({
      where: {
        organizationId_code: { organizationId, code: d.code },
      },
      create: {
        organizationId,
        code: d.code,
        name: d.name,
        sortOrder: d.sortOrder,
        mapsToCancel: d.mapsToCancel,
        isSystem: true,
        active: true,
      },
      update: {},
    });
  }
}

export function normalizeSituationCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}

export async function findOrgSituationId(
  organizationId: string,
  code: string,
): Promise<string | null> {
  await ensureDefaultOrderSituations(organizationId);
  const row = await prisma.orderSituation.findUnique({
    where: { organizationId_code: { organizationId, code } },
    select: { id: true },
  });
  return row?.id ?? null;
}
