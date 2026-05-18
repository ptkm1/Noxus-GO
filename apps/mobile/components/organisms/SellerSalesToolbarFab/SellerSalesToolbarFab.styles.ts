import { useMemo } from "react";
import { StyleSheet } from "react-native";

export type SellerSalesToolbarFabStylesParams = {
  fabBackgroundColor?: string;
};

export function useSellerSalesToolbarFabStyles(params: SellerSalesToolbarFabStylesParams = {}) {
  const { fabBackgroundColor = "#0284c7" } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        toolbar: {
          padding: 12,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#e2e8f0",
        },
        fab: {
          alignSelf: "flex-end",
          backgroundColor: fabBackgroundColor,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 10,
        },
        fabInner: { flexDirection: "row", alignItems: "center", gap: 8 },
        fabText: { color: "#fff", fontWeight: "600" },
      }),
    [fabBackgroundColor],
  );
}
