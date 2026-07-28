import { APP_BRAND_PRIMARY } from "@pedidos/shared";
import { useMemo } from "react";
import { StyleSheet } from "react-native";

export type BarcodeScannerModalStylesParams = {
  paddingTop: number;
  primaryButtonColor?: string;
};

export function useBarcodeScannerModalStyles(
  params: BarcodeScannerModalStylesParams,
) {
  const { paddingTop, primaryButtonColor = APP_BRAND_PRIMARY } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: "#0f172a", paddingTop },
        topBar: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
        },
        closeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
        closeText: { color: "#e2e8f0", fontSize: 16, fontWeight: "600" },
        title: {
          flex: 1,
          color: "#f8fafc",
          fontSize: 14,
          fontWeight: "600",
          textAlign: "center",
        },
        topSpacer: { width: 56 },
        camera: { flex: 1 },
        statusBar: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: "rgba(15, 23, 42, 0.92)",
        },
        statusText: {
          color: "#f8fafc",
          fontSize: 14,
          fontWeight: "600",
          textAlign: "center",
        },
        fallback: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          gap: 16,
        },
        fallbackText: { color: "#cbd5e1", fontSize: 16, textAlign: "center" },
        permBtn: {
          backgroundColor: primaryButtonColor,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 10,
        },
        permBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
      }),
    [paddingTop, primaryButtonColor],
  );
}
