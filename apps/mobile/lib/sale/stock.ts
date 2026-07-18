import type { SaleProduct } from "./types";

export function getProductStockBlockMessage(
  product: SaleProduct,
  currentQty: number,
  delta: number,
): string | null {
  if (delta <= 0) return null;
  if (!product.blockSaleWhenOutOfStock) return null;

  const stock = product.stockQty ?? 0;
  if (stock <= 0 && currentQty === 0) {
    return `Sem estoque para "${product.name}".`;
  }
  if (currentQty + delta > stock) {
    return `Estoque disponível: ${stock} un. para "${product.name}".`;
  }
  return null;
}
