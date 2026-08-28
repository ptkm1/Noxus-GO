import type { StockCountSortBy, StockSituation } from "@pedidos/shared";
import { listStockProducts } from "../stock-ledger.js";
import { parseStockExtras, type StockExtraFilters } from "./extra-filters.js";

export type StockReportFilters = {
  organizationId: string;
  supplierId?: string;
  categoryId?: string;
  q?: string;
  productIds?: string[];
  extras?: Record<string, string>;
  stockSituation?: StockSituation;
};

export type StockReportProduct = Awaited<
  ReturnType<typeof listStockProducts>
>[number];

function supplierLabel(p: StockReportProduct): string {
  return p.supplier?.tradeName || p.supplier?.legalName || "";
}

/** Mesma query e filtros extras do Relatório de Estoque. */
export async function loadStockReportProducts(
  filters: StockReportFilters,
): Promise<StockReportProduct[]> {
  const extra: StockExtraFilters = filters.extras
    ? parseStockExtras(filters.extras)
    : {};

  const listed = await listStockProducts({
    organizationId: filters.organizationId,
    supplierId: filters.supplierId,
    categoryId: filters.categoryId,
    q: filters.q,
    productIds: filters.productIds,
    stockQtyMin: extra.stockQtyMin,
    stockQtyMax: extra.stockQtyMax,
    productLine: extra.productLine,
    blockSaleWhenOutOfStock: extra.blockSaleWhenOutOfStock,
  });

  let products = listed;
  if (extra.hasExpiringSoon === true) {
    products = products.filter((p) => p.hasExpiringSoon);
  } else if (extra.hasExpiringSoon === false) {
    products = products.filter((p) => !p.hasExpiringSoon);
  }

  const stockSituation = filters.stockSituation ?? "with_stock";
  if (stockSituation === "with_stock") {
    products = products.filter((p) => p.stockQty > 0);
  }

  return products;
}

export function sortStockReportProducts(
  products: StockReportProduct[],
  sortBy: StockCountSortBy,
): StockReportProduct[] {
  const sorted = [...products];
  sorted.sort((a, b) => {
    if (sortBy === "supplier") {
      const cmp = supplierLabel(a).localeCompare(supplierLabel(b), "pt-BR");
      if (cmp !== 0) return cmp;
      return a.name.localeCompare(b.name, "pt-BR");
    }
    if (sortBy === "sku") {
      const cmp = (a.sku ?? "").localeCompare(b.sku ?? "", "pt-BR");
      if (cmp !== 0) return cmp;
      return a.name.localeCompare(b.name, "pt-BR");
    }
    return a.name.localeCompare(b.name, "pt-BR");
  });
  return sorted;
}
