import { HomeIndicatorWidget } from "@/components/HomeIndicatorWidget";

/** @deprecated Prefer `HomeIndicatorWidget` com `sales_by_supplier`. */
export function TopSuppliersChart() {
  return <HomeIndicatorWidget indicatorKey="sales_by_supplier" />;
}
