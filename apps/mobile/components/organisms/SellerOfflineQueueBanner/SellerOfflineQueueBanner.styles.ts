import { useMemo } from "react";
import { StyleSheet } from "react-native";

export type SellerOfflineQueueBannerStylesParams = {
  /** Reservado para tema whitelabel (ex.: cor de alerta da org). */
  accentBorderColor?: string;
};

export function useSellerOfflineQueueBannerStyles(params: SellerOfflineQueueBannerStylesParams = {}) {
  const { accentBorderColor = "#fcd34d" } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        offlineBanner: {
          marginHorizontal: 12,
          marginTop: 10,
          padding: 14,
          borderRadius: 12,
          backgroundColor: "#fef3c7",
          borderWidth: 1,
          borderColor: accentBorderColor,
          gap: 4,
        },
        offlineBannerTitle: { fontSize: 15, fontWeight: "700", color: "#92400e" },
        offlineBannerTxt: { fontSize: 13, color: "#78350f" },
        offlineBannerHint: { fontSize: 12, color: "#b45309", marginTop: 2 },
      }),
    [accentBorderColor],
  );
}
