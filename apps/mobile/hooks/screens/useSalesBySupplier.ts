import { apiFetch } from "@/lib/api";
import { periodRange, type PeriodPreset } from "@/lib/period-presets";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export type SalesBySupplierSummary = {
  period: { from: string; to: string };
  totals: { totalAmount: number; orderCount: number };
  topSuppliers: Array<{
    supplierId: string | null;
    tradeName: string;
    totalAmount: number;
    orderCount: number;
  }>;
};

export function useSalesBySupplier(initial: PeriodPreset = "this_month") {
  const [preset, setPreset] = useState<PeriodPreset | null>(initial);
  const [customRange, setCustomRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const range = useMemo(
    () => customRange ?? periodRange(preset ?? initial),
    [customRange, initial, preset],
  );

  const query = useQuery({
    queryKey: ["seller", "sales-by-supplier", range.from, range.to],
    queryFn: () => {
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
        limit: "5",
      });
      return apiFetch<SalesBySupplierSummary>(
        `/seller/reports/sales-by-supplier?${params}`,
      );
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  return {
    preset,
    selectPreset: (next: PeriodPreset) => {
      setCustomRange(null);
      setPreset(next);
    },
    setCustomRange: (next: { from: string; to: string }) => {
      setPreset(null);
      setCustomRange(next);
    },
    isCustomRange: customRange != null,
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
