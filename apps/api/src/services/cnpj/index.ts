import type { CnpjCompanyData } from "@pedidos/shared";
import { fetchCnpjFromBrasilApi } from "./brasilapi.js";
import { fetchCnpjFromSerpro, isSerproConfigured } from "./serpro.js";

export type CnpjProvider = "brasilapi" | "serpro";

export function readCnpjProvider(): CnpjProvider {
  const raw = process.env.CNPJ_PROVIDER?.trim().toLowerCase();
  if (raw === "serpro") return "serpro";
  return "brasilapi";
}

export function isCnpjProviderConfigured(provider: CnpjProvider = readCnpjProvider()): boolean {
  if (provider === "serpro") return isSerproConfigured();
  return true;
}

export async function fetchCnpj(digits14: string): Promise<CnpjCompanyData> {
  const provider = readCnpjProvider();
  if (provider === "serpro") {
    return fetchCnpjFromSerpro(digits14);
  }
  return fetchCnpjFromBrasilApi(digits14);
}
