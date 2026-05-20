import { computeGoogleDrivingRoute, isGoogleRoutesConfigured } from "./google-routes.js";
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
  roadRoutingConfigured: boolean;
  orderedCustomerIds: string[];
  orderedCustomers: RouteCustomerRow[];
  legKm: number[];
  legMinutes: number[];
  totalKm: number;
  totalMinutes: number;
  routePolyline: Array<{ latitude: number; longitude: number }>;
  disclaimer: string;
};

function normalizeLegValues(values: number[], expectedLegs: number, total: number): number[] {
  if (expectedLegs <= 0) return [];
  if (values.length === expectedLegs) return values;
  if (values.length === 0) {
    const each = total / expectedLegs;
    return Array.from({ length: expectedLegs }, () => Math.round(each * 1000) / 1000);
  }
  if (values.length > expectedLegs) return values.slice(0, expectedLegs);
  const sum = values.reduce((a, b) => a + b, 0);
  const rest = Math.max(0, total - sum);
  const extra = rest / (expectedLegs - values.length);
  return [
    ...values,
    ...Array.from({ length: expectedLegs - values.length }, () => Math.round(extra * 1000) / 1000),
  ];
}

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
  const roadRoutingConfigured = isGoogleRoutesConfigured();
  const google = await computeGoogleDrivingRoute(
    { lat: originLat, lng: originLng },
    orderedStops,
  );

  if (google && google.routePolyline.length >= 2) {
    const legCount = orderedCustomers.length;
    return {
      heuristic: "nearest_neighbor_then_google_routes",
      source: "google_routes",
      roadRoutingConfigured,
      orderedCustomerIds: air.orderedIds,
      orderedCustomers,
      legKm: normalizeLegValues(google.legKm, legCount, google.totalKm),
      legMinutes: normalizeLegValues(google.legMinutes, legCount, google.totalMinutes),
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
    roadRoutingConfigured,
    orderedCustomerIds: air.orderedIds,
    orderedCustomers,
    legKm: air.legKm,
    legMinutes,
    totalKm: air.totalKm,
    totalMinutes,
    routePolyline: straightPolyline(originLat, originLng, orderedCustomers),
    disclaimer: !roadRoutingConfigured
      ? "Linha reta — defina GOOGLE_MAPS_SERVER_API_KEY em apps/api/.env e ative Routes API no Google Cloud."
      : google === null
        ? "Linha reta — Google Routes falhou (verifique billing, Routes API e restrições da chave)."
        : "Linha reta — resposta do Google sem polyline; usa-se estimativa local.",
  };
}
