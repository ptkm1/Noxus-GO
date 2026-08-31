import {
  buildFinancialResultPdf as buildFinancialResultPdfCore,
  type FinancialPeriodGroup,
} from "../financial-result-report.js";

export type FinancialResultPdfFilters = {
  organizationId: string;
  orgName?: string | null;
  from?: string;
  to?: string;
  sellerId?: string;
  sellerIds?: string[];
  includeFixedCosts?: boolean;
  periodGroup?: FinancialPeriodGroup;
};

export async function buildFinancialResultPdf(
  filters: FinancialResultPdfFilters,
): Promise<Buffer> {
  let sellerIds = filters.sellerIds;
  if (filters.sellerId) {
    sellerIds = sellerIds
      ? sellerIds.filter((id) => id === filters.sellerId)
      : [filters.sellerId];
  }
  return buildFinancialResultPdfCore({
    organizationId: filters.organizationId,
    orgName: filters.orgName,
    from: filters.from,
    to: filters.to,
    sellerIds,
    includeFixedCosts: filters.includeFixedCosts,
    periodGroup: filters.periodGroup,
  });
}
