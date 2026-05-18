import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export type SellerNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export function useNotificationsScreen() {
  const qc = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["seller", "notifications"],
    queryFn: () => apiFetch<SellerNotification[]>("/seller/notifications"),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/seller/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["seller", "notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => apiFetch("/seller/notifications/read-all", { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["seller", "notifications"] }),
  });

  return {
    notifications: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isRefetching: listQuery.isRefetching,
    refetch: listQuery.refetch,
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAll.mutate(),
  };
}
