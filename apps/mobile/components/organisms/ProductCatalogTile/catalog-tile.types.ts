export type CatalogTileProduct = {
  id: string;
  name: string;
  sku?: string | null;
  imageUrl?: string | null;
  category?: { id: string; name: string } | null;
  effectiveUnitPrice?: number;
};
