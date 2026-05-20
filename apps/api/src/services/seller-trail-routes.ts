import { computeGoogleDrivingRoute, isGoogleRoutesConfigured, type LatLng } from "./google-routes.js";

/** Google Routes: até 25 intermediates + origem + destino. */
const MAX_STOPS_PER_REQUEST = 27;

export type TrailPolylineResult = {
  trailPolyline: Array<{ latitude: number; longitude: number }>;
  trailSource: "google_routes" | "gps_line";
  roadDistanceMeters: number | null;
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function gpsLinePolyline(points: LatLng[]): Array<{ latitude: number; longitude: number }> {
  return points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
}

function mergePolylines(
  segments: Array<Array<{ latitude: number; longitude: number }>>,
): Array<{ latitude: number; longitude: number }> {
  const out: Array<{ latitude: number; longitude: number }> = [];
  for (const seg of segments) {
    for (let i = 0; i < seg.length; i++) {
      const pt = seg[i]!;
      const prev = out[out.length - 1];
      if (
        prev &&
        Math.abs(prev.latitude - pt.latitude) < 1e-6 &&
        Math.abs(prev.longitude - pt.longitude) < 1e-6
      ) {
        continue;
      }
      out.push(pt);
    }
  }
  return out;
}

/** Divide pontos GPS em blocos compatíveis com o limite de paradas da Routes API. */
function chunkTrailPoints(points: LatLng[]): LatLng[][] {
  if (points.length <= MAX_STOPS_PER_REQUEST) return [points];
  const chunks: LatLng[][] = [];
  let start = 0;
  while (start < points.length - 1) {
    const end = Math.min(start + MAX_STOPS_PER_REQUEST - 1, points.length - 1);
    chunks.push(points.slice(start, end + 1));
    if (end >= points.length - 1) break;
    start = end;
  }
  return chunks;
}

/**
 * Trajeto cronológico do vendedor desenhado pelas vias (Google Routes), com fallback em linha GPS.
 */
export async function buildTrailRoadPolyline(
  points: Array<{ lat: number; lng: number }>,
): Promise<TrailPolylineResult> {
  const stops: LatLng[] = points.map((p) => ({ lat: p.lat, lng: p.lng }));

  if (stops.length < 2) {
    return {
      trailPolyline: gpsLinePolyline(stops),
      trailSource: "gps_line",
      roadDistanceMeters: null,
    };
  }

  if (!isGoogleRoutesConfigured()) {
    let d = 0;
    for (let i = 1; i < stops.length; i++) {
      d += haversineMeters(stops[i - 1]!.lat, stops[i - 1]!.lng, stops[i]!.lat, stops[i]!.lng);
    }
    return {
      trailPolyline: gpsLinePolyline(stops),
      trailSource: "gps_line",
      roadDistanceMeters: Math.round(d),
    };
  }

  const chunks = chunkTrailPoints(stops);
  const segmentPolylines: Array<Array<{ latitude: number; longitude: number }>> = [];
  let totalRoadMeters = 0;
  let anyGoogle = false;

  for (const chunk of chunks) {
    if (chunk.length < 2) continue;
    const origin = chunk[0]!;
    const rest = chunk.slice(1);
    const google = await computeGoogleDrivingRoute(origin, rest);
    if (google && google.routePolyline.length >= 2) {
      anyGoogle = true;
      segmentPolylines.push(google.routePolyline);
      totalRoadMeters += google.totalKm * 1000;
    } else {
      segmentPolylines.push(gpsLinePolyline(chunk));
      for (let i = 1; i < chunk.length; i++) {
        totalRoadMeters += haversineMeters(
          chunk[i - 1]!.lat,
          chunk[i - 1]!.lng,
          chunk[i]!.lat,
          chunk[i]!.lng,
        );
      }
    }
  }

  if (!anyGoogle) {
    let d = 0;
    for (let i = 1; i < stops.length; i++) {
      d += haversineMeters(stops[i - 1]!.lat, stops[i - 1]!.lng, stops[i]!.lat, stops[i]!.lng);
    }
    return {
      trailPolyline: gpsLinePolyline(stops),
      trailSource: "gps_line",
      roadDistanceMeters: Math.round(d),
    };
  }

  return {
    trailPolyline: mergePolylines(segmentPolylines),
    trailSource: "google_routes",
    roadDistanceMeters: Math.round(totalRoadMeters),
  };
}
