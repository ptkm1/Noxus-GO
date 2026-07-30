/** Normaliza CPF/CNPJ para apenas dígitos. */
export function normalizeDocument(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(digits[10]);
}

export function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const calc = (base: string, factors: number[]) => {
    const sum = factors.reduce((acc, f, i) => acc + Number(base[i]) * f, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(digits[12]) && d2 === Number(digits[13]);
}

export function isValidCpfOrCnpj(digits: string): boolean {
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}
