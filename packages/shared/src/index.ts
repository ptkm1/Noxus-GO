/** Rotas base da API v1 (alinhar com apps/api) */
export const API_PREFIX = "/api/v1";

export type Role = "ADMIN" | "SELLER" | "SUPERVISOR" | "MANAGER";

export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "CANCELLED"
  | "PENDING_CREDIT_APPROVAL";

export const ORDER_STATUSES: OrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "CANCELLED",
  "PENDING_CREDIT_APPROVAL",
];

export {
  cnpjDigitsOnly,
  formatBrazilPhoneDigits,
  formatCnpjAddress,
  formatCnpjMask,
  isCnpjComplete,
  isCnpjSituacaoAtiva,
  isValidCnpj,
  suggestedTradeName,
} from "./cnpj.js";
export type { CnpjCompanyData } from "./cnpj.js";
export {
  SELLER_COMMISSION_TYPES,
  sellerCommissionTypeLabel,
} from "./commission.js";
export type { SellerCommissionType } from "./commission.js";
export {
  FISCAL_INVOICE_STATUS_LABELS,
  FISCAL_TAX_REGIME_LABELS,
  NFE_ENVIRONMENT_LABELS,
  isProductFiscalReady,
} from "./fiscal.js";
export type {
  FiscalDocumentDirection,
  FiscalInvoiceStatus,
  FiscalManifestationType,
  FiscalOperationDirection,
  FiscalTaxRegime,
  NfeEnvironment,
} from "./fiscal.js";
export { STOCK_MOVEMENT_TYPE_LABELS } from "./stock.js";
export type { StockMovementType } from "./stock.js";
