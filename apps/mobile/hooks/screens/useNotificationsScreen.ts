import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppNotification } from "@pedidos/shared";
import { apiFetch } from "../../lib/api";

export type SellerNotification = AppNotification;

export function useNotificationsScreen() {
  const qc = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["seller", "notifications"],
    queryFn: () => apiFetch<SellerNotification[]>("/seller/notifications"),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/seller/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["seller", "notifications"] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () =>
      apiFetch("/seller/notifications/read-all", { method: "POST" }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["seller", "notifications"] }),
  });

  return {
    notifications: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isRefetching: listQuery.isRefetching,
    refetch: listQuery.refetch,
    markRead: (id: string) => {
      if (markReadMutation.isPending || markAllMutation.isPending) return;
      markReadMutation.mutate(id);
    },
    markAllRead: () => {
      if (markAllMutation.isPending) return;
      markAllMutation.mutate();
    },
    markReadPending: markReadMutation.isPending,
    markAllPending: markAllMutation.isPending,
    markingId: markReadMutation.isPending
      ? markReadMutation.variables
      : undefined,
  };
}
