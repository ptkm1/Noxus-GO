import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { apiFetch } from "../../lib/api";

export type SellerOrderDetail = {
  id: string;
  status: string;
  totalAmount: unknown;
  notes: string | null;
  creditHoldReasons?: unknown;
  createdAt: string;
  customer: { name: string } | null;
  items: { id: string; productName: string; quantity: number; unitPrice: unknown }[];
};

export function useSaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["seller", "sale", id],
    queryFn: () => apiFetch<SellerOrderDetail>(`/seller/sales/${id}`),
    enabled: !!id,
  });

  return {
    order: query.data,
    isLoading: query.isLoading,
  };
}
