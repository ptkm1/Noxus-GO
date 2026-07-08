import type { ProductSearchable } from "./product-search";

export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}

function codesMatch(
  stored: string,
  scanned: string,
  scannedDigits: string,
): boolean {
  const trimmed = stored.trim();
  if (!trimmed) return false;
  if (trimmed === scanned) return true;
  const storedDigits = normalizeBarcode(trimmed);
  if (
    scannedDigits.length >= 6 &&
    storedDigits.length >= 6 &&
    storedDigits === scannedDigits
  ) {
    return true;
  }
  return false;
}

export function findProductByBarcode<T extends ProductSearchable>(
  products: T[],
  raw: string,
): T | undefined {
  const trimmed = raw.trim();
  const digits = normalizeBarcode(raw);
  return products.find((p) => {
    if (codesMatch(p.barcode ?? "", trimmed, digits)) return true;
    return codesMatch(p.sku ?? "", trimmed, digits);
  });
}
