import { useMemo } from "react";
import { StyleSheet } from "react-native";

export type HorizontalProductRailStylesParams = {
  cellWidth: number;
};

export function useHorizontalProductRailStyles(params: HorizontalProductRailStylesParams) {
  const { cellWidth } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginTop: 14 },
        title: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8 },
        cell: { width: cellWidth, marginRight: 10 },
      }),
    [cellWidth],
  );
}
