import { cnpjDigitsOnly, isValidCnpj } from "@pedidos/shared";
import {
  emptyFiscalEmitente,
  fiscalEmitenteFromCnpj,
  type FiscalEmitenteSeed,
} from "./fiscal-emitente.js";
import { fetchCnpj } from "./index.js";

/** Consulta a Receita e monta o emitente. Se a consulta falhar, grava só o CNPJ. */
export async function lookupFiscalEmitente(
  cnpjDigits: string,
): Promise<FiscalEmitenteSeed> {
  const cnpj = cnpjDigitsOnly(cnpjDigits);
  const fallback = emptyFiscalEmitente(cnpj);
  if (!isValidCnpj(cnpj)) return fallback;
  try {
    const company = await fetchCnpj(cnpj);
    return { ...fiscalEmitenteFromCnpj(company), cnpj };
  } catch {
    return fallback;
  }
}
