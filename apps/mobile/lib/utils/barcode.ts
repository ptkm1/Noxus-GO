import type { ProductSearchable } from "./product-search";

export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function findProductByBarcode<T extends ProductSearchable>(
  products: T[],
  raw: string,
): T | undefined {
  const trimmed = raw.trim();
  const digits = normalizeBarcode(raw);
  return products.find((p) => {
    const sku = (p.sku ?? "").trim();
    if (!sku) return false;
    if (sku === trimmed) return true;
    const skuDigits = normalizeBarcode(sku);
    if (digits.length >= 6 && skuDigits.length >= 6 && skuDigits === digits) return true;
    return false;
  });
}
