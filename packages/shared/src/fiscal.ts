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

/** Rótulo de contingência SVC (tpEmis 6/7). Emissão normal retorna null. */
export function nfeTpEmisLabel(tpEmis?: string | null): string | null {
  const t = String(tpEmis ?? "").slice(0, 1);
  if (t === "6") return "Contingência SVC-AN";
  if (t === "7") return "Contingência SVC-RS";
  return null;
}

export function isProductFiscalReady(product: {
  ncmId?: string | null;
  ncm?: string | null;
  fiscalOrigin?: number | null;
  nfeOrigin?: number | null;
  fiscalUnit?: string | null;
  purchaseUnit?: string | null;
}): boolean {
  const hasNcm =
    Boolean(product.ncmId) ||
    Boolean(product.ncm && String(product.ncm).replace(/\D/g, "").length === 8);
  const hasOrigin = product.fiscalOrigin != null || product.nfeOrigin != null;
  const hasUnit = Boolean(product.fiscalUnit?.trim() || product.purchaseUnit?.trim());
  return hasNcm && hasOrigin && hasUnit;
}

export const FISCAL_MANIFESTATION_LABELS: Record<FiscalManifestationType, string> = {
  CIENCIA: "Ciência da Operação",
  CONFIRMACAO: "Confirmação da Operação",
  DESCONHECIMENTO: "Desconhecimento",
  NAO_REALIZADA: "Operação não realizada",
};
