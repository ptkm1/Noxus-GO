/**
 * Campos do grupo `<prod>` da NF-e 4.00 (MOC).
 * GTIN: NT 2017.001 — 8/12/13/14 dígitos ou literal SEM GTIN.
 * CEST: Convênio ICMS 92/2015 — 7 dígitos, obrigatório se o NCM está na tabela.
 * EXTIPI: exceção TIPI; omitir se vazio ou zero.
 */

export function nfeGtin(raw?: string | null): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 8 || d.length === 12 || d.length === 13 || d.length === 14) {
    return d;
  }
  return "SEM GTIN";
}

/** CEST sem máscara (17.005.00 → 1700500). Null se inválido. */
export function nfeCest(raw?: string | null): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length === 7 ? d : null;
}

/** EX TIPI. Null se vazio ou só zeros (o concorrente grava "0" = sem exceção). */
export function nfeExtIpi(raw?: string | null): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d || /^0+$/.test(d)) return null;
  return d.slice(0, 3);
}

export function nfeCProd(input: {
  sku?: string | null;
  barcode?: string | null;
  productId?: string | null;
  lineNumber: number;
}): string {
  const sku = input.sku?.trim();
  if (sku) return sku.slice(0, 60);
  const digits = (input.barcode ?? "").replace(/\D/g, "");
  if (digits) return digits.slice(0, 60);
  if (input.productId) return input.productId.slice(0, 60);
  return String(input.lineNumber);
}
