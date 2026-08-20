import type { CnpjCompanyData } from "@pedidos/shared";
import { cnpjDigitsOnly } from "@pedidos/shared";

export type FiscalEmitenteSeed = {
  cnpj: string;
  uf: string | null;
  city: string | null;
  cityIbge: string | null;
  street: string | null;
  addressNumber: string | null;
  complement: string | null;
  district: string | null;
  zipCode: string | null;
};

function ibgeCode(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const s = String(Math.trunc(raw));
    return s.length >= 6 ? s : null;
  }
  if (typeof raw === "string") {
    const d = raw.replace(/\D/g, "");
    return d.length >= 6 ? d : null;
  }
  return null;
}

/** IBGE do município, quando o provedor envia (BrasilAPI / Serpro). */
export function cnpjCityIbgeCode(json: Record<string, unknown>): string | null {
  return (
    ibgeCode(json.codigo_municipio_ibge) ??
    ibgeCode(json.codigo_municipio) ??
    ibgeCode(json.codigoMunicipioIbge) ??
    ibgeCode(json.codigoMunicipio)
  );
}

export function fiscalEmitenteFromCnpj(
  data: CnpjCompanyData,
): FiscalEmitenteSeed {
  const zip = (data.cep ?? "").replace(/\D/g, "").slice(0, 8);
  const uf = data.uf?.trim().toUpperCase().slice(0, 2) || null;
  return {
    cnpj: cnpjDigitsOnly(data.cnpj),
    uf: uf && uf.length === 2 ? uf : null,
    city: data.municipio?.trim() || null,
    cityIbge: data.cityIbgeCode?.replace(/\D/g, "") || null,
    street: data.logradouro?.trim() || null,
    addressNumber: data.numero?.trim() || null,
    complement: data.complemento?.trim() || null,
    district: data.bairro?.trim() || null,
    zipCode: zip.length === 8 ? zip : zip || null,
  };
}

export function emptyFiscalEmitente(cnpj: string): FiscalEmitenteSeed {
  return {
    cnpj: cnpjDigitsOnly(cnpj),
    uf: null,
    city: null,
    cityIbge: null,
    street: null,
    addressNumber: null,
    complement: null,
    district: null,
    zipCode: null,
  };
}

export function fiscalConfigCreateData(
  organizationId: string,
  emitente: FiscalEmitenteSeed,
) {
  return {
    organizationId,
    ...emitente,
    cnpj: emitente.cnpj || null,
    taxRegime: "SIMPLES_NACIONAL" as const,
    nfeEnvironment: "HOMOLOGATION" as const,
    nfeSeries: 1,
    nfeLastNumber: 0,
  };
}
