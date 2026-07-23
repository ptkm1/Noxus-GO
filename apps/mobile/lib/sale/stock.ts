import {
  formatInsufficientStockMessage,
  formatOutOfStockMessage,
} from "@pedidos/shared";
import type { CartLine, SaleProduct } from "./types";

export function getProductStockBlockMessage(
  product: SaleProduct,
  currentQty: number,
  delta: number,
): string | null {
  if (delta <= 0) return null;
  if (!product.blockSaleWhenOutOfStock) return null;

  const stock = product.stockQty ?? 0;
  const requested = currentQty + delta;
  if (stock <= 0) {
    return formatOutOfStockMessage(product.name, product.sku);
  }
  if (requested > stock) {
    return formatInsufficientStockMessage(
      product.name,
      stock,
      requested,
      product.sku,
    );
  }
  return null;
}

/** Valida o carrinho inteiro contra o catálogo (ex.: na finalização). */
export function getCartStockBlockMessage(
  lines: CartLine[],
  products: SaleProduct[],
): string | null {
  const byId = new Map(products.map((p) => [p.id, p]));
  const messages: string[] = [];

  for (const line of lines) {
    if (line.qty <= 0) continue;
    const product = byId.get(line.productId);
    if (!product?.blockSaleWhenOutOfStock) continue;
    const stock = product.stockQty ?? 0;
    if (stock <= 0) {
      messages.push(formatOutOfStockMessage(product.name, product.sku));
    } else if (line.qty > stock) {
      messages.push(
        formatInsufficientStockMessage(
          product.name,
          stock,
          line.qty,
          product.sku,
        ),
      );
    }
  }

  return messages.length > 0 ? messages.join(" ") : null;
}
