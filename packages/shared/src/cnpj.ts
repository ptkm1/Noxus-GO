/** Resposta normalizada de GET `/integrations/cnpj/:14digits` (proxy BrasilAPI). */
export type CnpjCompanyData = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  cep: string | null;
  uf: string | null;
  municipio: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  email: string | null;
  telefone: string | null;
  naturezaJuridica: string | null;
};

export function cnpjDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 14);
}

/** Ex.: `12345678000199` → `12.345.678/0001-99` */
export function formatCnpjMask(digitsMax14: string): string {
  const d = cnpjDigitsOnly(digitsMax14);
  let out = d.slice(0, 2);
  if (d.length <= 2) return out;
  out += "." + d.slice(2, 5);
  if (d.length <= 5) return out;
  out += "." + d.slice(5, 8);
  if (d.length <= 8) return out;
  out += "/" + d.slice(8, 12);
  if (d.length <= 12) return out;
  out += "-" + d.slice(12, 14);
  return out;
}

export function isCnpjComplete(digitsOrRaw: string): boolean {
  return cnpjDigitsOnly(digitsOrRaw).length === 14;
}

const CNPJ_WEIGHTS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const CNPJ_WEIGHTS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

function cnpjCheckDigit(digits: string, weights: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += Number(digits[i]) * weights[i]!;
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Valida CNPJ com dígitos verificadores (módulo 11). */
export function isValidCnpj(digitsOrRaw: string): boolean {
  const d = cnpjDigitsOnly(digitsOrRaw);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const dv1 = cnpjCheckDigit(d, CNPJ_WEIGHTS_DV1);
  if (dv1 !== Number(d[12])) return false;

  const dv2 = cnpjCheckDigit(d, CNPJ_WEIGHTS_DV2);
  return dv2 === Number(d[13]);
}

/** Endereço em uma linha para nota de endereço / prefill. */
export function formatCnpjAddress(
  data: Pick<
    CnpjCompanyData,
    "logradouro" | "numero" | "complemento" | "bairro" | "municipio" | "uf" | "cep"
  >,
): string | null {
  const parts: string[] = [];
  const street = [data.logradouro?.trim(), data.numero?.trim()].filter(Boolean).join(", ");
  if (street) parts.push(street);
  if (data.complemento?.trim()) parts.push(data.complemento.trim());
  if (data.bairro?.trim()) parts.push(data.bairro.trim());
  const city = [data.municipio?.trim(), data.uf?.trim()].filter(Boolean).join("/");
  if (city) parts.push(city);
  if (data.cep?.trim()) parts.push(`CEP ${data.cep.trim()}`);
  return parts.length > 0 ? parts.join(" — ") : null;
}

/** Situação cadastral considerada regular para operação comercial. */
export function isCnpjSituacaoAtiva(situacao: string | null | undefined): boolean {
  if (!situacao?.trim()) return true;
  return situacao.trim().toUpperCase() === "ATIVA";
}

/** Nome amigável para exibir/ficha: fantasia se existir, senão razão social. */
export function suggestedTradeName(data: Pick<CnpjCompanyData, "razaoSocial" | "nomeFantasia">): string {
  const nf = data.nomeFantasia?.trim();
  if (nf) return nf;
  return data.razaoSocial.trim();
}

/** Formata telefone nacional a partir de string só dígitos (ex. DDD+número colados). */
export function formatBrazilPhoneDigits(digits: string): string {
  const x = digits.replace(/\D/g, "");
  if (x.length === 11) return `(${x.slice(0, 2)}) ${x.slice(2, 7)}-${x.slice(7)}`;
  if (x.length === 10) return `(${x.slice(0, 2)}) ${x.slice(2, 6)}-${x.slice(6)}`;
  return digits.trim() || digits;
}
