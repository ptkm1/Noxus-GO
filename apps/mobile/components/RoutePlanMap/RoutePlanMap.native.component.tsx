import { MapPin } from "lucide-react-native";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { Platform, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import type { RoutePlanMapCoord, RoutePlanMapProps, RoutePlanMapRef } from "./RoutePlanMap.types";
import { useRoutePlanMapNativeStyles } from "./RoutePlanMap.native.styles";

export const RoutePlanMap = forwardRef<RoutePlanMapRef, RoutePlanMapProps>(function RoutePlanMap(
  { style, region, followUser, customers, polyCoords, onMarkerPress },
  ref,
) {
  const { styles, routeStrokeColor, markerColor } = useRoutePlanMapNativeStyles();
  const inner = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    fitRoute(coords: RoutePlanMapCoord[]) {
      inner.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 180, left: 40 },
        animated: true,
      });
    },
  }));

  return (
    <MapView
      ref={inner}
      style={style}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      initialRegion={region}
      region={followUser ? region : undefined}
      showsUserLocation
    >
      {customers.map((c) => (
        <Marker
          key={c.id}
          coordinate={{ latitude: c.latitude, longitude: c.longitude }}
          title={c.name}
          description={`≈ ${c.distanceKm} km`}
          onPress={() => onMarkerPress(c)}
        >
          <View style={styles.pinOuter}>
            <MapPin color={markerColor} size={28} strokeWidth={2.2} />
          </View>
        </Marker>
      ))}
      {polyCoords.length >= 2 ? (
        <Polyline coordinates={polyCoords} strokeColor={routeStrokeColor} strokeWidth={3} />
      ) : null}
    </MapView>
  );
});
