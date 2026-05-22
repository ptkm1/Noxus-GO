import { useCallback, useEffect, useState } from "react";
import { isLiveTrackWsPolylineEnabled } from "../lib/maps-features";
import type { SellerLocationWsEvent } from "./useSellerLocationsWs";

export type LiveTrailPoint = { lat: number; lng: number };

const MAX_POINTS = 500;
const MIN_MOVE_METERS = 15;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Acumula polyline GPS ao vivo para o vendedor selecionado (flag desligada por padrão).
 * Retorna callback para `useSellerLocationsWs` — uma única conexão WS.
 */
export function useLiveSellerTrailFromWs(
  selectedSellerId: string | null,
  seedPoints?: { lat: number; lng: number }[],
): { liveTrail: LiveTrailPoint[]; onSellerLocation: (msg: SellerLocationWsEvent) => void } {
  const enabled = isLiveTrackWsPolylineEnabled();
  const [liveTrail, setLiveTrail] = useState<LiveTrailPoint[]>([]);

  useEffect(() => {
    if (!enabled || !selectedSellerId) {
      setLiveTrail([]);
      return;
    }
    if (seedPoints && seedPoints.length >= 1) {
      setLiveTrail(seedPoints.map((p) => ({ lat: p.lat, lng: p.lng })));
    } else {
      setLiveTrail([]);
    }
  }, [enabled, selectedSellerId, seedPoints]);

  const onSellerLocation = useCallback(
    (msg: SellerLocationWsEvent) => {
      if (!enabled || !selectedSellerId || msg.sellerId !== selectedSellerId) return;

      setLiveTrail((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          haversineMeters(last.lat, last.lng, msg.latitude, msg.longitude) < MIN_MOVE_METERS
        ) {
          return prev;
        }
        const next: LiveTrailPoint[] = [
          ...prev,
          { lat: msg.latitude, lng: msg.longitude },
        ];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    },
    [enabled, selectedSellerId],
  );

  return {
    liveTrail: enabled ? liveTrail : [],
    onSellerLocation,
  };
}
