export type CatalogTileProduct = {
  id: string;
  name: string;
  sku?: string | null;
  imageUrl?: string | null;
  category?: { id: string; name: string } | null;
  effectiveUnitPrice?: number;
  catalogUnitPrice?: number;
  stockQty?: number;
  blockSaleWhenOutOfStock?: boolean;
  attributes?: Record<string, unknown>;
  featured?: boolean;
  hasActivePromotion?: boolean;
  highlighted?: boolean;
  promotionLabel?: string | null;
};
