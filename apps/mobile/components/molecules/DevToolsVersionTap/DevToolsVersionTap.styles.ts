import { useMemo } from "react";
import { StyleSheet } from "react-native";

export type DevToolsVersionTapVariant = "default" | "onDark";

export function useDevToolsVersionTapStyles(variant: DevToolsVersionTapVariant = "default") {
  return useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginTop: variant === "onDark" ? 20 : 28, alignItems: "center", padding: 12 },
        version: {
          fontSize: 12,
          fontWeight: "600",
          color: variant === "onDark" ? "#bae6fd" : "#94a3b8",
        },
        api: {
          marginTop: 4,
          fontSize: 11,
          color: variant === "onDark" ? "#7dd3fc" : "#cbd5e1",
          maxWidth: "100%",
          paddingHorizontal: 8,
        },
      }),
    [variant],
  );
}
