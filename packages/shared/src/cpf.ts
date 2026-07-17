export function cpfDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

/** Ex.: `12345678909` → `123.456.789-09` */
export function formatCpfMask(digitsMax11: string): string {
  const d = cpfDigitsOnly(digitsMax11);
  let out = d.slice(0, 3);
  if (d.length <= 3) return out;
  out += "." + d.slice(3, 6);
  if (d.length <= 6) return out;
  out += "." + d.slice(6, 9);
  if (d.length <= 9) return out;
  out += "-" + d.slice(9, 11);
  return out;
}

export function isCpfComplete(digitsOrRaw: string): boolean {
  return cpfDigitsOnly(digitsOrRaw).length === 11;
}

function cpfCheckDigit(digits: string, factor: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (factor - i);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

/** Valida CPF com dígitos verificadores. */
export function isValidCpf(digitsOrRaw: string): boolean {
  const d = cpfDigitsOnly(digitsOrRaw);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const dv1 = cpfCheckDigit(d.slice(0, 9), 10);
  if (dv1 !== Number(d[9])) return false;

  const dv2 = cpfCheckDigit(d.slice(0, 10), 11);
  return dv2 === Number(d[10]);
}
