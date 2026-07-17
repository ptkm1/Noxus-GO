import type { CustomerRecord } from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { apiFetch } from "../../lib/api";

export function useCustomersScreen() {
  const router = useRouter();

  const listQuery = useQuery({
    queryKey: ["seller", "customers"],
    queryFn: () => apiFetch<CustomerRecord[]>("/seller/customers"),
  });

  function openCustomer(id: string) {
    router.push(`/customer/${id}`);
  }

  function openNewCustomer() {
    router.push("/customer/form");
  }

  return {
    customers: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isRefetching: listQuery.isRefetching,
    refetch: listQuery.refetch,
    openCustomer,
    openNewCustomer,
  };
}
