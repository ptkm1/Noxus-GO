import { apiFetch, sharePdf } from "@/lib/api";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";

export type CommissionRow = { orderId: string; orderNumber: number | null; createdAt: string; customerName: string; saleAmount: number; commissionBase: number; commissionPercent: number; commissionAmount: number };
type Response = { period: { from: string; to: string }; totals: { saleAmount: number; commissionAmount: number; orderCount: number }; rows: CommissionRow[]; nextCursor: string | null };

export function useSellerCommissions() {
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const from = typeof params.from === "string" ? params.from : undefined;
  const to = typeof params.to === "string" ? params.to : undefined;
  const query = useInfiniteQuery({
    queryKey: ["seller", "commissions", from, to], initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), limit: "20", ...(pageParam ? { cursor: pageParam } : {}) });
      return apiFetch<Response>(`/seller/commissions?${q}`);
    }, getNextPageParam: (page) => page.nextCursor,
  });
  const first = query.data?.pages[0];
  return {
    from, to, period: first?.period, totals: first?.totals, rows: query.data?.pages.flatMap((page) => page.rows) ?? [],
    isLoading: query.isLoading, isFetching: query.isFetching, isFetchingNextPage: query.isFetchingNextPage, error: query.error,
    hasMore: query.hasNextPage, loadMore: () => void query.fetchNextPage(), refresh: () => void query.refetch(),
    share: () => { const q = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }); return sharePdf(`/seller/reports/commissions.pdf?${q}`, "minhas-comissoes.pdf"); },
  };
}
