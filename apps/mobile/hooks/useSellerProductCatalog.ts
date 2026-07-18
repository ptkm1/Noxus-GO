import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { isNetworkError } from "../lib/network-error";
import { loadFavoriteIds, toggleFavoriteId } from "../lib/product-favorites";
import type { SaleProduct } from "../lib/sale/types";
import {
  fetchSellerProductsBase,
  sellerOfflineStaleTime,
} from "../lib/seller-offline-queries";
import { matchesProductSearch } from "../lib/utils/product-search";

type Options = {
  customerId?: string;
};

export function useSellerProductCatalog(options: Options = {}) {
  const { customerId } = options;
  const productsQueryKey = ["seller", "products", customerId ?? ""] as const;

  const {
    data: products = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: productsQueryKey,
    staleTime: sellerOfflineStaleTime,
    queryFn: async () => {
      if (!customerId) {
        return fetchSellerProductsBase();
      }
      try {
        return await apiFetch<SaleProduct[]>(
          `/seller/products?customerId=${encodeURIComponent(customerId)}`,
        );
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        // Offline: preços especiais indisponíveis — catálogo base em cache
        return fetchSellerProductsBase();
      }
    },
  });

  const [productQuery, setProductQuery] = useState("");
  const [categoryFilterIds, setCategoryFilterIds] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void loadFavoriteIds().then((ids) => {
      if (!cancelled) setFavoriteIds(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    void toggleFavoriteId(id).then((next) => setFavoriteIds(new Set(next)));
  }, []);

  const catalogCategories = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const p of products) {
      if (p.category)
        m.set(p.category.id, { id: p.category.id, name: p.category.name });
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "pt"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const catSet =
      categoryFilterIds.length > 0 ? new Set(categoryFilterIds) : null;
    return products.filter((p) => {
      if (catSet && (!p.category || !catSet.has(p.category.id))) return false;
      return matchesProductSearch(p, productQuery);
    });
  }, [products, productQuery, categoryFilterIds]);

  const topSellingProducts = useMemo(() => {
    const hot = products.filter((p) => (p.soldQty ?? 0) > 0);
    return (hot.length ? hot : products).slice(0, 14);
  }, [products]);

  const favoriteProductsList = useMemo(() => {
    return products.filter((p) => favoriteIds.has(p.id)).slice(0, 18);
  }, [products, favoriteIds]);

  return {
    products,
    isLoading,
    isFetching,
    refetch,
    productQuery,
    setProductQuery,
    categoryFilterIds,
    setCategoryFilterIds,
    favoriteIds,
    toggleFavorite,
    catalogCategories,
    filteredProducts,
    topSellingProducts,
    favoriteProductsList,
  };
}
