import { prisma } from "../db.js";

/**
 * IDs de produto que o vendedor pode vender nesta organização.
 *
 * - Só entram produtos com `organizationId` da org (bloqueia sellerProduct cruzado).
 * - Se não houver liberação na org, cai no catálogo inteiro da org (conta nova = vazio).
 */
export async function listSellerCatalogProductIds(
  organizationId: string,
  sellerId: string,
): Promise<string[]> {
  if (!organizationId.trim() || !sellerId.trim()) return [];

  const assigned = await prisma.sellerProduct.findMany({
    where: {
      sellerId,
      seller: { organizationId },
      product: { organizationId },
    },
    select: { productId: true },
  });
  if (assigned.length > 0) {
    return assigned.map((row) => row.productId);
  }

  const catalog = await prisma.product.findMany({
    where: { organizationId },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  return catalog.map((row) => row.id);
}

export async function listAssignedProductsInOrg(
  organizationId: string,
  sellerId: string,
) {
  const links = await prisma.sellerProduct.findMany({
    where: {
      sellerId,
      seller: { organizationId },
      product: { organizationId },
    },
    include: { product: true },
  });
  return links.map((link) => link.product);
}
