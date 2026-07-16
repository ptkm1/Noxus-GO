import type { CepAddressData } from "@pedidos/shared";
import { BRASIL_API_HEADERS } from "../brasilapi-headers.js";

type BrasilApiCep = {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
};

export async function fetchCep(digits8: string): Promise<CepAddressData> {
  const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits8}`, {
    headers: BRASIL_API_HEADERS,
  });
  if (res.status === 404) {
    throw new Error("CEP não encontrado.");
  }
  if (!res.ok) {
    throw new Error("Falha ao consultar CEP.");
  }
  const json = (await res.json()) as BrasilApiCep;
  return {
    cep: digits8,
    state: typeof json.state === "string" ? json.state.toUpperCase() : "",
    city: typeof json.city === "string" ? json.city : "",
    neighborhood:
      typeof json.neighborhood === "string" ? json.neighborhood : null,
    street: typeof json.street === "string" ? json.street : null,
    cityIbgeCode: null,
  };
}
