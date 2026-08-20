import { findProductByBarcode as findByBarcode } from "@pedidos/shared";
import type { ProductSearchable } from "./product-search";

export { normalizeBarcode } from "@pedidos/shared";

export function findProductByBarcode<T extends ProductSearchable>(
  products: T[],
  raw: string,
): T | undefined {
  return findByBarcode(products, raw);
}
