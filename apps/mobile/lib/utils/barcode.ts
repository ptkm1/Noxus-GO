import type { ProductSearchable } from "./product-search";

export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Variants for UPC-A (12) vs EAN-13 (leading 0) equality. */
function digitVariants(digits: string): string[] {
  const out = new Set<string>();
  if (!digits) return [];
  out.add(digits);
  if (digits.length === 12) out.add(`0${digits}`);
  if (digits.length === 13 && digits.startsWith("0")) {
    out.add(digits.slice(1));
  }
  return [...out];
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
  if (storedDigits.length < 6 || scannedDigits.length < 6) return false;
  const scannedSet = new Set(digitVariants(scannedDigits));
  for (const v of digitVariants(storedDigits)) {
    if (scannedSet.has(v)) return true;
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
