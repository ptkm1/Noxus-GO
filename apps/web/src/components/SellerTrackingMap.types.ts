export type SellerMapMarker = {
  sellerId: string;
  sellerName: string;
  latitude: number;
  longitude: number;
  isOnline: boolean;
  activeVisitCustomerName: string | null;
  recordedAt: string | null;
};

export type TrailPoint = { lat: number; lng: number };

export type SellerTrackingMapProps = {
  markers: SellerMapMarker[];
  selectedSellerId: string | null;
  onSelectSeller: (sellerId: string | null) => void;
  trail?: TrailPoint[];
  /** Trajeto GPS acumulado via WebSocket (flag VITE_LIVE_TRACK_WS_POLYLINE_ENABLED). */
  liveTrail?: TrailPoint[];
};
