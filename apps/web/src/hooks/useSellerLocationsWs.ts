import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_PREFIX } from "@pedidos/shared";
import { getAccessToken } from "../lib/api";

type SellerLocationRow = {
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  active: boolean;
  isOnline: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  recordedAt: string | null;
  activeVisit: {
    id: string;
    customerId: string;
    customerName: string;
    checkedInAt: string;
  } | null;
};

type Payload = {
  onlineThresholdMinutes: number;
  sellers: SellerLocationRow[];
};

export type SellerLocationWsEvent = {
  sellerId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  recordedAt: string;
};

type WsMessage = {
  type: "seller_location";
} & SellerLocationWsEvent;

function wsUrl(accessToken: string): string {
  const env = import.meta.env.VITE_API_URL;
  const base = env ? env.replace(/\/$/, "") : window.location.origin;
  const proto = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  const path = `${API_PREFIX}/admin/seller-locations/ws`;
  return `${proto}://${host}${path}?access_token=${encodeURIComponent(accessToken)}`;
}

export function useSellerLocationsWs(
  enabled: boolean,
  options?: { onSellerLocation?: (msg: SellerLocationWsEvent) => void },
): { connected: boolean } {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    const accessToken = token;
    let ws: WebSocket | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closed) return;
      ws = new WebSocket(wsUrl(accessToken));

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retryTimer = setTimeout(connect, 4000);
      };
      ws.onerror = () => ws?.close();

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as WsMessage;
          if (msg.type !== "seller_location") return;

          options?.onSellerLocation?.({
            sellerId: msg.sellerId,
            latitude: msg.latitude,
            longitude: msg.longitude,
            accuracyMeters: msg.accuracyMeters,
            recordedAt: msg.recordedAt,
          });

          qc.setQueryData<Payload>(["admin", "seller-locations"], (prev) => {
            if (!prev) return prev;
            const thresholdMs = prev.onlineThresholdMinutes * 60_000;
            const now = Date.now();
            const sellers = prev.sellers.map((s) => {
              if (s.sellerId !== msg.sellerId) return s;
              const recordedAt = msg.recordedAt;
              const isOnline = now - new Date(recordedAt).getTime() < thresholdMs;
              return {
                ...s,
                latitude: msg.latitude,
                longitude: msg.longitude,
                accuracyMeters: msg.accuracyMeters,
                recordedAt,
                isOnline,
              };
            });
            return { ...prev, sellers };
          });
        } catch {
          /* ignore malformed */
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
      setConnected(false);
    };
  }, [enabled, qc, options?.onSellerLocation]);

  return { connected };
}
