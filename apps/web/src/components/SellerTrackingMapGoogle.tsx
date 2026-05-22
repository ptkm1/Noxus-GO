import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  Polyline,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useMemo } from "react";
import { getGoogleMapsApiKey } from "../lib/google-maps-config";
import { googleMapsSearchUrl } from "../lib/maps-links";
import type { SellerMapMarker, SellerTrackingMapProps } from "./SellerTrackingMap.types";

const ONLINE_COLOR = "#5ee9a8";
const OFFLINE_COLOR = "#9ca3af";
const TRAIL_COLOR = "#6b9ee8";
const LIVE_TRAIL_COLOR = "#7c3aed";
const MAP_PADDING = 48;

function MapFitBounds({
  markers,
  trail,
  liveTrail,
}: {
  markers: SellerMapMarker[];
  trail: { lat: number; lng: number }[];
  liveTrail: { lat: number; lng: number }[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    const bounds = new google.maps.LatLngBounds();
    let hasPoint = false;

    for (const m of markers) {
      bounds.extend({ lat: m.latitude, lng: m.longitude });
      hasPoint = true;
    }
    for (const p of trail) {
      bounds.extend({ lat: p.lat, lng: p.lng });
      hasPoint = true;
    }
    for (const p of liveTrail) {
      bounds.extend({ lat: p.lat, lng: p.lng });
      hasPoint = true;
    }

    if (!hasPoint) return;

    if (markers.length === 1 && trail.length < 2) {
      const c = markers[0]!;
      map.setCenter({ lat: c.latitude, lng: c.longitude });
      map.setZoom(14);
      return;
    }

    map.fitBounds(bounds, MAP_PADDING);
  }, [map, markers, trail, liveTrail]);

  return null;
}

function SellerMarker({
  marker,
  selected,
  onSelect,
}: {
  marker: SellerMapMarker;
  selected: boolean;
  onSelect: () => void;
}) {
  const icon = useMemo(() => {
    if (typeof google === "undefined") return undefined;
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: selected ? 10 : 8,
      fillColor: marker.isOnline ? ONLINE_COLOR : OFFLINE_COLOR,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    };
  }, [marker.isOnline, selected]);

  return (
    <Marker
      position={{ lat: marker.latitude, lng: marker.longitude }}
      title={marker.sellerName}
      icon={icon}
      onClick={onSelect}
      zIndex={selected ? 10 : marker.isOnline ? 5 : 1}
    />
  );
}

function SelectedInfoWindow({
  marker,
  onClose,
}: {
  marker: SellerMapMarker;
  onClose: () => void;
}) {
  const when = marker.recordedAt
    ? new Date(marker.recordedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

  return (
    <InfoWindow
      position={{ lat: marker.latitude, lng: marker.longitude }}
      onCloseClick={onClose}
    >
      <div className="max-w-[220px] text-sm text-foreground">
        <p className="font-semibold">{marker.sellerName}</p>
        <p className="mt-1">
          {marker.isOnline ? "Online" : "Offline"} · {when}
        </p>
        {marker.activeVisitCustomerName ? (
          <p className="mt-1 text-warning">Visita: {marker.activeVisitCustomerName}</p>
        ) : null}
        <p className="mt-2">
          <a
            href={googleMapsSearchUrl(marker.latitude, marker.longitude, marker.sellerName)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-700 hover:underline"
          >
            Abrir no Google Maps
          </a>
        </p>
      </div>
    </InfoWindow>
  );
}

function DashedLivePolyline({ path }: { path: { lat: number; lng: number }[] }) {
  const icons = useMemo(() => {
    if (typeof google === "undefined") return undefined;
    return [
      {
        icon: {
          path: "M 0,-1 0,1",
          strokeOpacity: 1,
          scale: 3,
          strokeColor: LIVE_TRAIL_COLOR,
        },
        offset: "0",
        repeat: "14px",
      },
    ];
  }, []);

  if (path.length < 2) return null;

  return (
    <Polyline
      path={path}
      strokeColor={LIVE_TRAIL_COLOR}
      strokeOpacity={0}
      strokeWeight={4}
      icons={icons}
    />
  );
}

export function SellerTrackingMapGoogle(props: SellerTrackingMapProps) {
  const { markers, selectedSellerId, onSelectSeller, trail = [], liveTrail = [] } = props;
  const apiKey = getGoogleMapsApiKey()!;

  const defaultCenter = useMemo(() => {
    if (markers.length > 0) {
      return { lat: markers[0]!.latitude, lng: markers[0]!.longitude };
    }
    return { lat: -14.235, lng: -51.9253 };
  }, [markers]);

  const selected = markers.find((m) => m.sellerId === selectedSellerId) ?? null;

  const trailPath = useMemo(
    () => trail.map((p) => ({ lat: p.lat, lng: p.lng })),
    [trail],
  );

  const liveTrailPath = useMemo(
    () => liveTrail.map((p) => ({ lat: p.lat, lng: p.lng })),
    [liveTrail],
  );

  return (
    <APIProvider apiKey={apiKey} language="pt-BR" region="BR">
      <div className="h-[min(520px,60vh)] w-full overflow-hidden rounded-xl border border-border">
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={markers.length ? 10 : 4}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl
          fullscreenControl
          style={{ width: "100%", height: "100%" }}
        >
          <MapFitBounds markers={markers} trail={trail} liveTrail={liveTrail} />

          {liveTrailPath.length >= 2 ? <DashedLivePolyline path={liveTrailPath} /> : null}

          {trailPath.length >= 2 ? (
            <Polyline
              path={trailPath}
              strokeColor={TRAIL_COLOR}
              strokeOpacity={0.85}
              strokeWeight={4}
            />
          ) : null}

          {markers.map((m) => (
            <SellerMarker
              key={m.sellerId}
              marker={m}
              selected={m.sellerId === selectedSellerId}
              onSelect={() => onSelectSeller(m.sellerId)}
            />
          ))}

          {selected ? (
            <SelectedInfoWindow marker={selected} onClose={() => onSelectSeller(null)} />
          ) : null}
        </Map>
      </div>
    </APIProvider>
  );
}
