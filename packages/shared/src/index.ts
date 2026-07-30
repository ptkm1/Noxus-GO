/** Rotas base da API v1 (alinhar com apps/api) */
export const API_PREFIX = "/api/v1";

export {
  CHECKOUT_INTENT_STATUSES,
  isCheckoutIntentStatus,
  mapIntentToPublicStatus,
} from "./billing.js";
export type {
  CheckoutIntentStatus,
  PublicIntentNextAction,
  PublicIntentStatus,
} from "./billing.js";

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
  cepDigitsOnly,
  formatCepMask,
  formatStructuredAddress,
  isCepComplete,
} from "./address.js";
export type {
  CepAddressData,
  CustomerAddressFields,
  IbgeMunicipio,
  IbgeUf,
} from "./address.js";
export {
  APP_BRAND_BACKGROUND,
  APP_BRAND_BORDER,
  APP_BRAND_LILAC,
  APP_BRAND_NAME,
  APP_BRAND_NAVY,
  APP_BRAND_PRIMARY,
  APP_BRAND_SHORT,
  APP_BRAND_TAGLINE,
  COMMERCE_PRO_ICON_ASPECT,
  COMMERCE_PRO_ICON_PATH,
  COMMERCE_PRO_ICON_PATHS,
  COMMERCE_PRO_ICON_VIEWBOX,
  PEDIX_PRO_ICON_ASPECT,
  PEDIX_PRO_ICON_LOOP_PATH,
  PEDIX_PRO_ICON_PATHS,
  PEDIX_PRO_ICON_STEM_PATH,
  PEDIX_PRO_ICON_VIEWBOX,
} from "./brand.js";
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
  cpfDigitsOnly,
  formatCpfMask,
  isCpfComplete,
  isValidCpf,
} from "./cpf.js";
export {
  customerFormErrorStep,
  customerToForm,
  emptyCustomerForm,
  FIELD_NOT_APPLICABLE,
  formToCustomerPayload,
  isCustomerFormValid,
  isFieldNotApplicable,
  isStateRegistrationUnavailable,
  isStreetNumberSn,
  STATE_REGISTRATION_UNAVAILABLE,
  STREET_NUMBER_SN,
  validateCustomerForm,
  validateCustomerFormStep,
} from "./customer-form.js";
export type {
  CustomerApprovalStatus,
  CustomerDocumentType,
  CustomerFormErrors,
  CustomerFormValues,
  CustomerRecord,
  CustomerStatus,
} from "./customer-form.js";
export {
  FISCAL_INVOICE_STATUS_LABELS,
  FISCAL_MANIFESTATION_LABELS,
  FISCAL_TAX_REGIME_LABELS,
  isProductFiscalReady,
  NFE_ENVIRONMENT_LABELS,
} from "./fiscal.js";
export type {
  FiscalDocumentDirection,
  FiscalInvoiceStatus,
  FiscalManifestationType,
  FiscalOperationDirection,
  FiscalTaxRegime,
  NfeEnvironment,
} from "./fiscal.js";
export {
  formatRelativeSaleDate,
  formatSaleItemCount,
} from "./format-sale-date.js";
export {
  DEFAULT_HOME_INDICATORS,
  DEFAULT_HOME_INDICATORS_LAYOUT,
  HOME_INDICATOR_KEYS,
  HOME_INDICATOR_LABELS,
  HOME_INDICATOR_SHORT_LABELS,
  HOME_INDICATORS_LAYOUT_LABELS,
  HOME_INDICATORS_LAYOUTS,
  isHomeIndicatorKey,
  isHomeIndicatorsLayout,
  MAX_HOME_INDICATORS,
  normalizeHomeIndicators,
  normalizeHomeIndicatorsLayout,
} from "./home-indicators.js";
export type {
  HomeIndicatorKey,
  HomeIndicatorsLayout,
} from "./home-indicators.js";
export {
  NOTIFICATION_TYPES,
  notificationBodyDisplay,
  notificationHref,
} from "./notifications.js";
export type {
  AppNotification,
  NotificationData,
  NotificationType,
} from "./notifications.js";
export {
  canRead,
  canWrite,
  EDITABLE_ROLES,
  getPermission,
  levelAllowsRead,
  levelAllowsWrite,
  LOCKED_ROLES,
  PERMISSION_RESOURCE_LABELS,
  PERMISSION_RESOURCES,
  resolvePermission,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from "./permissions.js";
export type {
  PermissionLevel,
  PermissionResource,
  PermissionsMap,
} from "./permissions.js";
export {
  cheapestPlanWithFeature,
  DEFAULT_PLAN_ID,
  DEFAULT_TRIAL_DAYS,
  getPlanDefinition,
  isPlanId,
  listPlans,
  PLAN_CATALOG,
  PLAN_FEATURE_LABELS,
  PLAN_IDS,
  planHasFeature,
} from "./plans.js";
export type {
  PlanDefinition,
  PlanFeature,
  PlanId,
  PlanLimits,
} from "./plans.js";
export {
  formatInsufficientStockMessage,
  formatOutOfStockMessage,
  formatProductPriceWithUnit,
  formatProductStockItemLabel,
  formatProductStockLabel,
  formatProductUnitLabel,
  isProductSaleBlockedByStock,
} from "./product-display.js";
export {
  computeMarkupPercent,
  emptyProductForm,
  formToProductPayload,
  isNcmComplete,
  normalizeNcm,
  PRODUCT_CLASSIFICATIONS,
  productClassificationLabel,
  productToForm,
  PURCHASE_UNITS,
  validateProductForm,
} from "./product-form.js";
export type {
  ProductApiPayload,
  ProductClassification,
  ProductFormErrors,
  ProductFormTab,
  ProductFormValidation,
  ProductFormValues,
  ProductRecord,
} from "./product-form.js";
export { STOCK_MOVEMENT_TYPE_LABELS } from "./stock.js";
export type { StockMovementType } from "./stock.js";
