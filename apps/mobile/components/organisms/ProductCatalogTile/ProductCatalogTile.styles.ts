import { useMemo } from "react";
import { StyleSheet } from "react-native";

export type ProductCatalogTileStylesParams = {
  tileWidth: number;
  imgHeight: number;
  badgeBackgroundColor?: string;
};

export function useProductCatalogTileStyles(params: ProductCatalogTileStylesParams) {
  const { tileWidth, imgHeight, badgeBackgroundColor = "#0284c7" } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: tileWidth,
          backgroundColor: "#fff",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#e2e8f0",
          overflow: "hidden",
          marginBottom: 2,
        },
        favBtn: {
          position: "absolute",
          top: 6,
          right: 6,
          zIndex: 2,
          padding: 6,
          borderRadius: 20,
          backgroundColor: "#ffffffe8",
        },
        mainTap: { paddingHorizontal: 10, paddingBottom: 10, paddingTop: 8 },
        imgBox: {
          height: imgHeight,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: "#f1f5f9",
          marginBottom: 8,
        },
        img: { width: "100%", height: "100%" },
        imgPh: { flex: 1, alignItems: "center", justifyContent: "center" },
        badge: {
          position: "absolute",
          bottom: 8,
          right: 8,
          backgroundColor: badgeBackgroundColor,
          minWidth: 26,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 10,
          alignItems: "center",
        },
        badgeTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
        name: { fontSize: 14, fontWeight: "700", color: "#0f172a", lineHeight: 18, minHeight: 36 },
        catLine: { marginTop: 2, fontSize: 11, fontWeight: "600", color: "#0369a1" },
        price: { marginTop: 6, fontSize: 15, fontWeight: "800", color: "#047857" },
        noPrice: { marginTop: 6, fontSize: 13, fontWeight: "600", color: "#94a3b8" },
      }),
    [tileWidth, imgHeight, badgeBackgroundColor],
  );
}
