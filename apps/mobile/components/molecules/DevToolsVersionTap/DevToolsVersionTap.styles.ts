import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "../../../lib/theme";

export type DevToolsVersionTapVariant = "default" | "onDark";

export function useDevToolsVersionTapStyles(variant: DevToolsVersionTapVariant = "default") {
  const { colors } = useTheme();

  return useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginTop: variant === "onDark" ? 20 : 28, alignItems: "center", padding: 12 },
        version: {
          fontSize: 12,
          fontWeight: "600",
          color: variant === "onDark" ? colors.onDarkMuted : colors.textMuted,
        },
        api: {
          marginTop: 4,
          fontSize: 11,
          color: variant === "onDark" ? colors.onDarkSubtle : colors.borderSubtle,
          maxWidth: "100%",
          paddingHorizontal: 8,
        },
      }),
    [variant, colors],
  );
}
