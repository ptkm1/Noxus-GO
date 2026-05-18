import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { apiFetch } from "../../lib/api";
import { useOfflineOutboxCounts } from "../../lib/useOfflineOutboxCounts";

export type SellerOrderListItem = {
  id: string;
  status: string;
  totalAmount: unknown;
  createdAt: string;
  customer: { name: string } | null;
  items: { quantity: number; productName: string }[];
};

export function useSalesListScreen() {
  const router = useRouter();
  const { pending, dead } = useOfflineOutboxCounts();
  const query = useQuery({
    queryKey: ["seller", "sales"],
    queryFn: () => apiFetch<SellerOrderListItem[]>("/seller/sales"),
  });

  return {
    orders: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    pending,
    dead,
    goQuickSale: () => router.push("/quick-sale"),
    goOfflineQueue: () => router.push("/sales/offline-queue"),
  };
}
