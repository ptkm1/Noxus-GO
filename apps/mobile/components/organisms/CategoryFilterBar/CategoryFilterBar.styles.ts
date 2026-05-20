import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "../../../lib/theme";

export type CategoryFilterBarStylesParams = {
  chipActiveBackgroundColor?: string;
};

export function useCategoryFilterBarStyles(params: CategoryFilterBarStylesParams = {}) {
  const { colors } = useTheme();
  const { chipActiveBackgroundColor = colors.chipActive } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginTop: 12, marginBottom: 4 },
        title: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginBottom: 8 },
        chip: {
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 20,
          backgroundColor: colors.chip,
          marginRight: 8,
          maxWidth: 200,
        },
        chipOn: { backgroundColor: chipActiveBackgroundColor },
        chipTxt: { color: colors.chipText, fontSize: 14, fontWeight: "600" },
        chipTxtOn: { color: colors.chipTextActive },
      }),
    [chipActiveBackgroundColor, colors],
  );
}
