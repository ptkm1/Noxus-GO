import { useQuery } from "@tanstack/react-query";
import {
  fetchSellerOrgSettings,
  SELLER_ORG_SETTINGS_KEY,
  sellerOfflineStaleTime,
  type OrderSyncMode,
  type SellerOrgSettings,
} from "../lib/seller-offline-queries";

export function useOrderSyncMode(): {
  orderSyncMode: OrderSyncMode;
  isLoading: boolean;
  settings: SellerOrgSettings | undefined;
} {
  const { data, isLoading } = useQuery({
    queryKey: SELLER_ORG_SETTINGS_KEY,
    queryFn: fetchSellerOrgSettings,
    staleTime: sellerOfflineStaleTime,
  });

  return {
    orderSyncMode: data?.orderSyncMode ?? "AUTO",
    isLoading,
    settings: data,
  };
}
