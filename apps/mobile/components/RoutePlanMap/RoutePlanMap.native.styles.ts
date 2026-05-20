import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useTheme } from "../../lib/theme";

export type RoutePlanMapNativeStylesParams = {
  routeStrokeColor?: string;
  markerColor?: string;
};

export function useRoutePlanMapNativeStyles(params: RoutePlanMapNativeStylesParams = {}) {
  const { colors } = useTheme();
  const { routeStrokeColor = colors.primary, markerColor = colors.primary } = params;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pinOuter: { alignItems: "center", justifyContent: "center" },
        pinOuterActive: {
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.warningSurface,
          borderRadius: 20,
          padding: 4,
          borderWidth: 2,
          borderColor: colors.warning,
        },
      }),
    [colors],
  );

  return {
    styles,
    routeStrokeColor,
    markerColor,
    activeMarkerColor: colors.warning,
  };
}
