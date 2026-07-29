import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { listRepeatableSalesInLookback } from "../../lib/repeat-sale";
import {
  fetchSellerSales,
  SELLER_SALES_KEY,
  sellerOfflineStaleTime,
} from "../../lib/seller-offline-queries";

export function useRepeatSalePickerScreen() {
  const router = useRouter();
  const query = useQuery({
    queryKey: SELLER_SALES_KEY,
    staleTime: sellerOfflineStaleTime,
    queryFn: fetchSellerSales,
  });

  const candidates = useMemo(
    () => listRepeatableSalesInLookback(query.data ?? []),
    [query.data],
  );

  const pickSale = useCallback(
    (saleId: string) => {
      router.push({
        pathname: "/quick-sale",
        params: { repeatSaleId: saleId },
      });
    },
    [router],
  );

  return {
    candidates,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    pickSale,
  };
}
