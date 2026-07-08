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

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  PENDING_CREDIT_APPROVAL: "Aguardando crédito",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

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
  formatProductPriceWithUnit,
  formatProductStockLabel,
  formatProductUnitLabel,
  isProductSaleBlockedByStock,
} from "./product-display.js";
export {
  formatRelativeSaleDate,
  formatSaleItemCount,
} from "./format-sale-date.js";
