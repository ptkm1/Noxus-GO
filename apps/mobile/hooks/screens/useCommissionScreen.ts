import { useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export type CommissionTierRow = {
  id: string;
  thresholdAmount: number;
  commissionPercent: number;
  label: string | null;
  achieved: boolean;
  scope: string;
};

export type CommissionDashboard = {
  period: { year: number; month: number; label: string };
  mtd: { confirmedRevenue: number; commissionRecorded: number };
  rulesSummary: {
    productRulesCount: number;
    categoryRulesCount: number;
    generalRulesCount: number;
    progressiveTierCount: number;
  };
  baselineCommissionPercent: number;
  progressive: {
    ladder: CommissionTierRow[];
    activeTier: CommissionTierRow | null;
    nextTier: CommissionTierRow | null;
    gapToNextAmount: number | null;
    effectivePercent: number | null;
  };
  goal: {
    title: string;
    scope?: "SELLER" | "TEAM" | "ALL";
    scopeLabel?: string;
    targetAmount: number | null;
    progressPercent: number | null;
    achievedAmount: number;
  } | null;
  ranking: {
    position: number | null;
    totalSellers: number;
    myAmount: number;
    top: Array<{ rank: number; name: string; totalAmount: number; isMe: boolean }>;
  };
};

export function useCommissionScreen() {
  const insets = useSafeAreaInsets();
  const query = useQuery({
    queryKey: ["seller", "commission-dashboard"],
    queryFn: () => apiFetch<CommissionDashboard>("/seller/commission-dashboard"),
  });

  const onRefresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    insets,
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    onRefresh,
  };
}
