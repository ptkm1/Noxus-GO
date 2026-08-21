import { DEFAULT_PURCHASE_UNITS } from "@pedidos/shared";
import { prisma } from "../db.js";

export async function ensureDefaultPurchaseUnits(
  organizationId: string,
): Promise<void> {
  for (const d of DEFAULT_PURCHASE_UNITS) {
    await prisma.purchaseUnit.upsert({
      where: {
        organizationId_code: { organizationId, code: d.code },
      },
      create: {
        organizationId,
        code: d.code,
        name: d.name,
        sortOrder: d.sortOrder,
        isSystem: true,
      },
      update: {},
    });
  }
}

export async function listOrgPurchaseUnits(organizationId: string) {
  await ensureDefaultPurchaseUnits(organizationId);
  return prisma.purchaseUnit.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}
