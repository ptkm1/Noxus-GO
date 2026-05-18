export type SaleProduct = {
  id: string;
  name: string;
  sku?: string | null;
  soldQty?: number;
  basePrice: unknown;
  catalogUnitPrice?: number;
  effectiveUnitPrice?: number;
  promotionLabel?: string | null;
  maxSellerDiscountPercent?: number | null;
  maxSellerDiscountPercentEffective?: number;
  minSaleUnitPrice?: number | null;
  category?: { id: string; code: string; name: string } | null;
  imageUrl?: string | null;
};

export type SaleCustomer = { id: string; name: string };

export type CreditOverview = {
  creditBlocked: boolean;
  creditLimit: number | null;
  creditPolicy: string;
  openBalance: number;
  overdueCount: number;
  overdueAmount: number;
  violations: Array<{ code: string; message: string }>;
  effectiveAction: string;
};

export type CartLine = {
  productId: string;
  name: string;
  sku: string | null;
  qty: number;
  effectiveUnitPrice: number;
  catalogUnitPrice?: number;
  promotionLabel?: string | null;
  discountPercent: number;
  maxSellerDiscountPercent: number;
};
