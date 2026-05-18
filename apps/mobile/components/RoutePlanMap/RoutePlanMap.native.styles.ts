import { useMemo } from "react";
import { StyleSheet } from "react-native";

export type RoutePlanMapNativeStylesParams = {
  routeStrokeColor?: string;
  markerColor?: string;
};

export function useRoutePlanMapNativeStyles(params: RoutePlanMapNativeStylesParams = {}) {
  const { routeStrokeColor = "#0284c7", markerColor = "#0284c7" } = params;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pinOuter: { alignItems: "center", justifyContent: "center" },
      }),
    [],
  );

  return { styles, routeStrokeColor, markerColor };
}
