import { APP_BRAND_PRIMARY } from "@pedidos/shared";
import { useMemo } from "react";
import { StyleSheet } from "react-native";

export type MoneyLabelStylesParams = {
  color?: string;
  fontSize?: number;
  fontWeight?: "400" | "500" | "600" | "700" | "800";
};

export function useMoneyLabelStyles(params: MoneyLabelStylesParams = {}) {
  const { color = APP_BRAND_PRIMARY, fontSize = 16, fontWeight = "600" } = params;

  return useMemo(
    () =>
      StyleSheet.create({
        text: { color, fontSize, fontWeight },
      }),
    [color, fontSize, fontWeight],
  );
}
