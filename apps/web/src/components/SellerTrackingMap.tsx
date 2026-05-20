import { isGoogleMapsConfigured } from "../lib/google-maps-config";
import { SellerTrackingMapGoogle } from "./SellerTrackingMapGoogle";
import { SellerTrackingMapLeaflet } from "./SellerTrackingMapLeaflet";
import type { SellerMapMarker, SellerTrackingMapProps, TrailPoint } from "./SellerTrackingMap.types";

export type { SellerMapMarker, TrailPoint };

/**
 * Rastreio ao vivo: Google Maps (igual ao mobile) quando há chave;
 * fallback OpenStreetMap/Leaflet sem chave.
 */
export function SellerTrackingMap(props: SellerTrackingMapProps) {
  if (isGoogleMapsConfigured()) {
    return <SellerTrackingMapGoogle {...props} />;
  }

  return (
    <div className="space-y-2">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Mapa OpenStreetMap (sem chave Google). Defina{" "}
        <code className="rounded bg-amber-100 px-1">VITE_GOOGLE_MAPS_API_KEY</code> ou use a mesma{" "}
        <code className="rounded bg-amber-100 px-1">EXPO_PUBLIC_GOOGLE_MAPS_API_KEY</code> no{" "}
        <code className="rounded bg-amber-100 px-1">.env</code> da raiz e ative{" "}
        <strong>Maps JavaScript API</strong> no Google Cloud.
      </p>
      <SellerTrackingMapLeaflet {...props} />
    </div>
  );
}
