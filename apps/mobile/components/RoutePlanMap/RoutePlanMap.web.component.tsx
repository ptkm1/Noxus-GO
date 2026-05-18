import { forwardRef, useImperativeHandle } from "react";
import { Text, View } from "react-native";
import type { RoutePlanMapCoord, RoutePlanMapProps, RoutePlanMapRef } from "./RoutePlanMap.types";
import { useRoutePlanMapWebStyles } from "./RoutePlanMap.web.styles";

/** Na web o `react-native-maps` não é suportado; evita carregar codegen nativo. */
export const RoutePlanMap = forwardRef<RoutePlanMapRef, RoutePlanMapProps>(function RoutePlanMap({ style }, ref) {
  const styles = useRoutePlanMapWebStyles();

  useImperativeHandle(ref, () => ({
    fitRoute(_coords: RoutePlanMapCoord[]) {},
  }));

  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.fallbackTxt}>Mapa disponível na app iOS/Android.</Text>
    </View>
  );
});
