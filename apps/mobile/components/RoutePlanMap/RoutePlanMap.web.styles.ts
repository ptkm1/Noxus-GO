import { useMemo } from "react";
import { StyleSheet } from "react-native";

export function useRoutePlanMapWebStyles() {
  return useMemo(
    () =>
      StyleSheet.create({
        fallback: {
          borderRadius: 14,
          backgroundColor: "#e2e8f0",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        fallbackTxt: {
          color: "#64748b",
          fontWeight: "600",
          textAlign: "center",
          paddingHorizontal: 16,
        },
      }),
    [],
  );
}
