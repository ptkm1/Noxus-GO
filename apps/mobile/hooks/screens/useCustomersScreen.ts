import type { CustomerRecord } from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  fetchSellerCustomers,
  sellerOfflineStaleTime,
} from "../../lib/seller-offline-queries";

export function useCustomersScreen() {
  const router = useRouter();

  const listQuery = useQuery({
    queryKey: ["seller", "customers"],
    staleTime: sellerOfflineStaleTime,
    queryFn: fetchSellerCustomers,
  });

  function openCustomer(id: string) {
    router.push(`/customer/${id}`);
  }

  function openNewCustomer() {
    router.push("/customer/form");
  }

  return {
    customers: listQuery.data ?? ([] as CustomerRecord[]),
    isLoading: listQuery.isLoading,
    isRefetching: listQuery.isRefetching,
    refetch: listQuery.refetch,
    openCustomer,
    openNewCustomer,
  };
}
