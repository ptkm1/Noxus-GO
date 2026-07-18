import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "../../../lib/theme";

export type ProductCatalogTileStylesParams = {
  variant: "rail" | "grid" | "list";
  tileWidth: number;
  imgHeight: number;
  badgeBackgroundColor?: string;
  disabled?: boolean;
};

export function useProductCatalogTileStyles(
  params: ProductCatalogTileStylesParams,
) {
  const { colors } = useTheme();
  const {
    variant,
    tileWidth,
    imgHeight,
    badgeBackgroundColor = colors.primary,
    disabled = false,
  } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: tileWidth,
          backgroundColor: colors.card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          marginBottom: 2,
          opacity: disabled ? 0.55 : 1,
        },
        favBtn: {
          position: "absolute",
          top: variant === "list" ? 10 : 6,
          right: variant === "list" ? 10 : 6,
          zIndex: 2,
          padding: 6,
          borderRadius: 20,
          backgroundColor: colors.background,
        },
        mainTap: {
          flexDirection: variant === "list" ? "row" : "column",
          alignItems: variant === "list" ? "center" : "stretch",
          paddingHorizontal: variant === "list" ? 10 : 10,
          paddingBottom: variant === "list" ? 10 : 10,
          paddingTop: variant === "list" ? 10 : 8,
          gap: variant === "list" ? 12 : 0,
        },
        imgBox: {
          width: variant === "list" ? 56 : "100%",
          height: variant === "list" ? 56 : imgHeight,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: colors.surfaceMuted,
          marginBottom: variant === "list" ? 0 : 8,
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
        badgeTxt: {
          color: colors.chipTextActive,
          fontWeight: "800",
          fontSize: 13,
        },
        body: {
          flex: variant === "list" ? 1 : undefined,
          paddingRight: variant === "list" ? 36 : 0,
        },
        name: {
          fontSize: variant === "list" ? 14 : 12,
          fontWeight: "700",
          color: colors.text,
          lineHeight: variant === "list" ? 20 : 18,
          minHeight: variant === "list" ? undefined : 36,
        },
        catLine: {
          marginTop: 2,
          fontSize: 11,
          fontWeight: "600",
          color: colors.link,
        },
        metaLine: {
          marginTop: 4,
          fontSize: 11,
          fontWeight: "600",
          color: colors.textMuted,
        },
        stockLine: { marginTop: 2, fontSize: 11, fontWeight: "700" },
        price: {
          marginTop: 6,
          ...(variant === "list" && { top: 15 }),
          fontSize: variant === "list" ? 14 : 12,
          fontWeight: "800",
          color: colors.success,
        },
        noPrice: {
          marginTop: 6,
          fontSize: 13,
          fontWeight: "600",
          color: colors.textMuted,
        },
      }),
    [variant, tileWidth, imgHeight, badgeBackgroundColor, disabled, colors],
  );
}
