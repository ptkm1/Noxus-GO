import { useMemo } from "react";
import { StyleSheet } from "react-native";

export type SellerAccessBlockStylesParams = {
  primaryButtonColor?: string;
};

export function useSellerAccessBlockStyles(params: SellerAccessBlockStylesParams = {}) {
  const { primaryButtonColor = "#0284c7" } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        wrap: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#f8fafc", gap: 16 },
        title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
        body: { fontSize: 16, color: "#475569", lineHeight: 24 },
        btn: {
          marginTop: 8,
          backgroundColor: primaryButtonColor,
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
        },
        btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
      }),
    [primaryButtonColor],
  );
}
