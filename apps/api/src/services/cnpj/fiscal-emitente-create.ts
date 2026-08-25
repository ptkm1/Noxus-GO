import type { FiscalEmitenteSeed } from "./fiscal-emitente.js";

export type EstablishmentCreateSeed = {
  organizationId: string;
  legalName: string;
  tradeName?: string | null;
  isPrimary?: boolean;
} & FiscalEmitenteSeed;

/** Dados para criar o estabelecimento principal no signup / checkout. */
export function establishmentCreateData(input: EstablishmentCreateSeed) {
  return {
    organizationId: input.organizationId,
    legalName: input.legalName.trim() || "Estabelecimento principal",
    tradeName: input.tradeName?.trim() || null,
    cnpj: input.cnpj || null,
    uf: input.uf,
    city: input.city,
    cityIbge: input.cityIbge,
    street: input.street,
    addressNumber: input.addressNumber,
    complement: input.complement,
    district: input.district,
    zipCode: input.zipCode,
    taxRegime: "SIMPLES_NACIONAL" as const,
    nfeEnvironment: "HOMOLOGATION" as const,
    nfeSeries: 1,
    nfeLastNumber: 0,
    isPrimary: input.isPrimary !== false,
    active: true,
  };
}

/** @deprecated Use establishmentCreateData — mantido para imports legados. */
export function fiscalConfigCreateData(
  organizationId: string,
  emitente: FiscalEmitenteSeed,
  legalName = "Estabelecimento principal",
) {
  return establishmentCreateData({
    organizationId,
    legalName,
    ...emitente,
  });
}
