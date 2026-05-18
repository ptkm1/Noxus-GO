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

export type OptimizeRouteResp = {
  orderedCustomerIds: string[];
  legKm: number[];
  totalKmApprox: number;
  orderedCustomers: Array<{ id: string; name: string; latitude: number; longitude: number }>;
};

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
