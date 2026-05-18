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
