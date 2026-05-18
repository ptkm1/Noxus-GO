import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import type { SaleProduct } from "../lib/sale/types";
import { loadFavoriteIds, toggleFavoriteId } from "../lib/product-favorites";
import { matchesProductSearch } from "../lib/utils/product-search";

type Options = {
  customerId?: string;
};

export function useSellerProductCatalog(options: Options = {}) {
  const { customerId } = options;
  const productsQueryKey = ["seller", "products", customerId ?? ""] as const;

  const { data: products = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: productsQueryKey,
    queryFn: () =>
      apiFetch<SaleProduct[]>(
        `/seller/products${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ""}`,
      ),
  });

  const [productQuery, setProductQuery] = useState("");
  const [categoryFilterId, setCategoryFilterId] = useState<string | null>(null);
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
      if (p.category) m.set(p.category.id, { id: p.category.id, name: p.category.name });
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "pt"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilterId && p.category?.id !== categoryFilterId) return false;
      return matchesProductSearch(p, productQuery);
    });
  }, [products, productQuery, categoryFilterId]);

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
    categoryFilterId,
    setCategoryFilterId,
    favoriteIds,
    toggleFavorite,
    catalogCategories,
    filteredProducts,
    topSellingProducts,
    favoriteProductsList,
  };
}
