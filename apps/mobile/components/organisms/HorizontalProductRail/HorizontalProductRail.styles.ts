import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "../../../lib/theme";

export type HorizontalProductRailStylesParams = {
  cellWidth: number;
};

export function useHorizontalProductRailStyles(params: HorizontalProductRailStylesParams) {
  const { colors } = useTheme();
  const { cellWidth } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginTop: 14 },
        title: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginBottom: 8 },
        cell: { width: cellWidth, marginRight: 10 },
      }),
    [cellWidth, colors],
  );
}
