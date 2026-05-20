import { computeGoogleDrivingRoute } from "./google-routes.js";
import { greedyNearestRoute, type GeoStop } from "./route-plan.js";

export type RouteCustomerRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type RouteDirectionsResponse = {
  heuristic: string;
  source: "google_routes" | "air_fallback";
  orderedCustomerIds: string[];
  orderedCustomers: RouteCustomerRow[];
  legKm: number[];
  legMinutes: number[];
  totalKm: number;
  totalMinutes: number;
  routePolyline: Array<{ latitude: number; longitude: number }>;
  disclaimer: string;
};

function straightPolyline(
  originLat: number,
  originLng: number,
  ordered: RouteCustomerRow[],
): Array<{ latitude: number; longitude: number }> {
  return [
    { latitude: originLat, longitude: originLng },
    ...ordered.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
  ];
}

/** Estimativa grosseira de tempo (~40 km/h médio) quando Google não está disponível. */
function estimateLegMinutes(legKm: number): number {
  if (legKm <= 0) return 0;
  return Math.max(1, Math.round((legKm / 40) * 60));
}

export async function buildRouteDirections(
  originLat: number,
  originLng: number,
  rows: RouteCustomerRow[],
): Promise<RouteDirectionsResponse> {
  const stops: GeoStop[] = rows.map((r) => ({ id: r.id, lat: r.latitude, lng: r.longitude }));
  const air = greedyNearestRoute(originLat, originLng, stops);

  const orderedCustomers = air.orderedIds.map((oid) => {
    const r = rows.find((x) => x.id === oid)!;
    return {
      id: r.id,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
    };
  });

  const orderedStops = orderedCustomers.map((c) => ({ lat: c.latitude, lng: c.longitude }));
  const google = await computeGoogleDrivingRoute(
    { lat: originLat, lng: originLng },
    orderedStops,
  );

  if (google && google.legKm.length === orderedCustomers.length) {
    return {
      heuristic: "nearest_neighbor_then_google_routes",
      source: "google_routes",
      orderedCustomerIds: air.orderedIds,
      orderedCustomers,
      legKm: google.legKm,
      legMinutes: google.legMinutes,
      totalKm: google.totalKm,
      totalMinutes: google.totalMinutes,
      routePolyline: google.routePolyline,
      disclaimer:
        "Ordem: vizinho mais próximo (linha reta). Traçado e tempos por estrada (Google Routes). Trânsito pode variar.",
    };
  }

  const legMinutes = air.legKm.map(estimateLegMinutes);
  const totalMinutes = legMinutes.reduce((a, b) => a + b, 0);

  return {
    heuristic: "nearest_neighbor_air_distance",
    source: "air_fallback",
    orderedCustomerIds: air.orderedIds,
    orderedCustomers,
    legKm: air.legKm,
    legMinutes,
    totalKm: air.totalKm,
    totalMinutes,
    routePolyline: straightPolyline(originLat, originLng, orderedCustomers),
    disclaimer:
      google === null
        ? "Rota em linha reta — Google Routes indisponível (configure GOOGLE_MAPS_SERVER_API_KEY e ative Routes API)."
        : "Rota em linha reta — resposta do Google incompleta; usa-se estimativa local.",
  };
}
