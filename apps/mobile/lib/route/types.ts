export type NearbyCustomersResp = {
  origin: { lat: number; lng: number };
  radiusKm: number;
  customers: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    addressNote: string | null;
    distanceKm: number;
    assignedToMe: boolean;
  }>;
  disclaimerAirKm: string;
};

export type RouteCoord = { latitude: number; longitude: number };

export type DirectionsRouteResp = {
  heuristic: string;
  source: "google_routes" | "air_fallback";
  orderedCustomerIds: string[];
  legKm: number[];
  legMinutes: number[];
  totalKm: number;
  totalKmApprox: number;
  totalMinutes: number;
  orderedCustomers: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  routePolyline: RouteCoord[];
  disclaimer: string;
};

/** @deprecated Use DirectionsRouteResp — mantido para compatibilidade. */
export type OptimizeRouteResp = DirectionsRouteResp;

export type SellerVisit = {
  id: string;
  customerId: string;
  customerName: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  durationSeconds: number | null;
  secondsOpen: number | null;
  notes: string | null;
};

export type RouteCustomerPin = { id: string; name: string };
