/** Resposta normalizada de GET `/integrations/cep/:8digits`. */
export type CepAddressData = {
  cep: string;
  state: string;
  city: string;
  neighborhood: string | null;
  street: string | null;
  cityIbgeCode: string | null;
};

export type IbgeUf = {
  id: number;
  sigla: string;
  nome: string;
};

export type IbgeMunicipio = {
  id: number;
  nome: string;
};

export function cepDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

export function formatCepMask(digitsMax8: string): string {
  const d = cepDigitsOnly(digitsMax8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5, 8)}`;
}

export function isCepComplete(digitsOrRaw: string): boolean {
  return cepDigitsOnly(digitsOrRaw).length === 8;
}

export type CustomerAddressFields = {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
};

/** Endereço em uma linha para nota / rota. */
export function formatStructuredAddress(
  data: CustomerAddressFields,
): string | null {
  const parts: string[] = [];
  const street = [data.street?.trim(), data.number?.trim()]
    .filter(Boolean)
    .join(", ");
  if (street) parts.push(street);
  if (data.neighborhood?.trim()) parts.push(data.neighborhood.trim());
  const city = [data.city?.trim(), data.state?.trim()]
    .filter(Boolean)
    .join("/");
  if (city) parts.push(city);
  if (data.cep?.trim()) {
    const cep = cepDigitsOnly(data.cep);
    parts.push(cep.length === 8 ? formatCepMask(cep) : data.cep.trim());
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
