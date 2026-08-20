/** Helpers de validação de cartão (sem persistir dados sensíveis). */

export function normalizeCardNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function maskCardNumberLast4(raw: string): string {
  const digits = normalizeCardNumber(raw);
  if (digits.length < 4) return "****";
  return `**** ${digits.slice(-4)}`;
}

/** Algoritmo de Luhn — validação básica do número do cartão. */
export function isValidLuhn(cardNumber: string): boolean {
  const digits = normalizeCardNumber(cardNumber);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function parseCardExpiry(raw: string): {
  month: string;
  year: string;
} | null {
  const cleaned = raw.replace(/\s/g, "");
  const match = /^(\d{2})\/?(\d{2,4})$/.exec(cleaned);
  if (!match) return null;
  const month = match[1]!;
  const yearPart = match[2]!;
  const monthNum = Number.parseInt(month, 10);
  if (monthNum < 1 || monthNum > 12) return null;
  const year =
    yearPart.length === 2 ? `20${yearPart}` : yearPart.padStart(4, "0");
  if (!isValidCardExpiry(month, year)) return null;
  return { month, year };
}

export function isValidCardExpiry(month: string, year: string): boolean {
  const m = Number.parseInt(month, 10);
  const y = Number.parseInt(year.length === 2 ? `20${year}` : year, 10);
  if (m < 1 || m > 12) return false;
  const now = new Date();
  const expEnd = new Date(y, m, 0, 23, 59, 59, 999);
  return expEnd >= now;
}

export function isValidCvv(cvv: string): boolean {
  const digits = cvv.replace(/\D/g, "");
  return digits.length >= 3 && digits.length <= 4;
}

export function formatCardExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function formatCardNumberInput(raw: string): string {
  const digits = normalizeCardNumber(raw).slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
