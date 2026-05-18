import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { apiFetch } from "../../lib/api";
import { creditPolicyLabel } from "../../lib/utils/credit-policy";

export type CustomerCreditSnap = {
  creditBlocked: boolean;
  creditLimit: number | null;
  creditPolicy: string;
  openBalance: number;
  overdueCount: number;
  overdueAmount: number;
  violations: Array<{ code: string; message: string }>;
  effectiveAction: string;
  titlesOpen: Array<{
    id: string;
    reference: string | null;
    remaining: number;
    dueDate: string;
    overdue: boolean;
    status: string;
    notes: string | null;
  }>;
  titlesHistory: Array<{
    id: string;
    reference: string | null;
    remaining: number;
    dueDate: string;
    status: string;
    notes: string | null;
  }>;
};

export function useCustomerCreditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["seller", "customer-credit", id ?? "", "detail"],
    queryFn: () => apiFetch<CustomerCreditSnap>(`/seller/customers/${id}/credit`),
    enabled: !!id,
  });

  const effectiveActionLabel = (action: string) => {
    if (action === "BLOCK") return "pedido bloqueado";
    if (action === "APPROVAL") return "pedido pode ir para aprovação";
    return "avisos apenas";
  };

  return {
    snap: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    policyLabel: creditPolicyLabel,
    effectiveActionLabel,
  };
}
