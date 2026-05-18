import { useMemo } from "react";
import { StyleSheet } from "react-native";

export type CategoryFilterBarStylesParams = {
  chipActiveBackgroundColor?: string;
};

export function useCategoryFilterBarStyles(params: CategoryFilterBarStylesParams = {}) {
  const { chipActiveBackgroundColor = "#0284c7" } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginTop: 12, marginBottom: 4 },
        title: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8 },
        chip: {
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 20,
          backgroundColor: "#e2e8f0",
          marginRight: 8,
          maxWidth: 200,
        },
        chipOn: { backgroundColor: chipActiveBackgroundColor },
        chipTxt: { color: "#334155", fontSize: 14, fontWeight: "600" },
        chipTxtOn: { color: "#fff" },
      }),
    [chipActiveBackgroundColor],
  );
}
