import { useMemo } from "react";
import type { StyleSheet } from "react-native";
import { useTheme } from "../lib/theme";
import type { AppColors } from "../lib/theme/types";

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: AppColors) => T,
): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
