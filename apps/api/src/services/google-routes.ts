import { decodeEncodedPolyline } from "../lib/polyline.js";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.legs.distanceMeters",
  "routes.legs.duration",
].join(",");

export type LatLng = { lat: number; lng: number };

export type GoogleDrivingRoute = {
  routePolyline: Array<{ latitude: number; longitude: number }>;
  legKm: number[];
  legMinutes: number[];
  totalKm: number;
  totalMinutes: number;
};

function parseDurationSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(duration.trim());
  if (!m) return 0;
  return Math.round(Number(m[1]));
}

function getServerApiKey(): string | undefined {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  return key || undefined;
}

/** Indica se a API pode pedir rotas por estrada (chave no apps/api/.env). */
export function isGoogleRoutesConfigured(): boolean {
  return !!getServerApiKey();
}

/**
 * Rota de condução com paradas na ordem dada (sem reordenar waypoints).
 * Retorna null se chave em falta ou erro da API.
 */
export async function computeGoogleDrivingRoute(
  origin: LatLng,
  orderedStops: LatLng[],
): Promise<GoogleDrivingRoute | null> {
  const apiKey = getServerApiKey();
  if (!apiKey || orderedStops.length === 0) return null;

  const destination = orderedStops[orderedStops.length - 1]!;
  const intermediates = orderedStops.slice(0, -1).map((s) => ({
    location: { latLng: { latitude: s.lat, longitude: s.lng } },
  }));

  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: {
      location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
    },
    ...(intermediates.length > 0 ? { intermediates } : {}),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
    computeAlternativeRoutes: false,
    languageCode: "pt-BR",
    units: "METRIC",
  };

  try {
    const res = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[google-routes] computeRoutes failed", res.status, errText.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        polyline?: { encodedPolyline?: string };
        legs?: Array<{ distanceMeters?: number; duration?: string }>;
      }>;
    };

    const route = data.routes?.[0];
    if (!route?.polyline?.encodedPolyline) return null;

    const routePolyline = decodeEncodedPolyline(route.polyline.encodedPolyline);
    const legs = route.legs ?? [];

    const legKm = legs.map((leg) =>
      Math.round(((leg.distanceMeters ?? 0) / 1000) * 1000) / 1000,
    );
    const legMinutes = legs.map((leg) =>
      Math.max(1, Math.round(parseDurationSeconds(leg.duration) / 60)),
    );

    const totalKm =
      Math.round(
        ((route.distanceMeters ?? legs.reduce((s, l) => s + (l.distanceMeters ?? 0), 0)) / 1000) *
          1000,
      ) / 1000;
    const totalSeconds = parseDurationSeconds(route.duration);
    const totalMinutes =
      totalSeconds > 0
        ? Math.max(1, Math.round(totalSeconds / 60))
        : legMinutes.reduce((a, b) => a + b, 0);

    return {
      routePolyline,
      legKm,
      legMinutes,
      totalKm,
      totalMinutes,
    };
  } catch (e) {
    console.warn("[google-routes] computeRoutes error", e);
    return null;
  }
}
