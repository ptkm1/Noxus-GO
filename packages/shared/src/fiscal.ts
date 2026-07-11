export type FiscalDocumentDirection = "OUTBOUND" | "INBOUND";

export type FiscalInvoiceStatus =
  | "DRAFT"
  | "TRANSMITTED"
  | "AUTHORIZED"
  | "REJECTED"
  | "CANCELLED"
  | "IMPORTED";

export type NfeEnvironment = "HOMOLOGATION" | "PRODUCTION";

export type FiscalTaxRegime =
  | "SIMPLES_NACIONAL"
  | "LUCRO_PRESUMIDO"
  | "LUCRO_REAL";

export type FiscalOperationDirection = "INBOUND" | "OUTBOUND";

export type FiscalManifestationType =
  | "CIENCIA"
  | "CONFIRMACAO"
  | "DESCONHECIMENTO"
  | "NAO_REALIZADA";

export const FISCAL_INVOICE_STATUS_LABELS: Record<FiscalInvoiceStatus, string> = {
  DRAFT: "Rascunho",
  TRANSMITTED: "Transmitida",
  AUTHORIZED: "Autorizada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
  IMPORTED: "Importada",
};

export const FISCAL_TAX_REGIME_LABELS: Record<FiscalTaxRegime, string> = {
  SIMPLES_NACIONAL: "Simples Nacional",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
};

export const NFE_ENVIRONMENT_LABELS: Record<NfeEnvironment, string> = {
  HOMOLOGATION: "Homologação",
  PRODUCTION: "Produção",
};

export function isProductFiscalReady(product: {
  ncmId?: string | null;
  fiscalOrigin?: number | null;
  fiscalUnit?: string | null;
}): boolean {
  return Boolean(
    product.ncmId &&
      product.fiscalOrigin != null &&
      product.fiscalUnit?.trim(),
  );
}
