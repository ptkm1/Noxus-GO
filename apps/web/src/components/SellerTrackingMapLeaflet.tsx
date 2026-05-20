import L from "leaflet";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { googleMapsSearchUrl } from "../lib/maps-links";
import type { SellerTrackingMapProps } from "./SellerTrackingMap.types";

const ONLINE_COLOR = "#16a34a";
const OFFLINE_COLOR = "#64748b";
const TRAIL_COLOR = "#0284c7";

function sellerIcon(isOnline: boolean, selected: boolean) {
  const color = isOnline ? ONLINE_COLOR : OFFLINE_COLOR;
  const ring = selected ? `box-shadow:0 0 0 3px #0284c7;` : "";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;${ring}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fallback OpenStreetMap quando não há chave Google Maps JavaScript API. */
export function SellerTrackingMapLeaflet({
  markers,
  selectedSellerId,
  onSelectSeller,
  trail = [],
}: SellerTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView([-14.235, -51.9253], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      trailRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (trailRef.current) {
      map.removeLayer(trailRef.current);
      trailRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    if (trail.length >= 2) {
      const latlngs = trail.map((p) => L.latLng(p.lat, p.lng));
      latlngs.forEach((ll) => bounds.extend(ll));
      trailRef.current = L.polyline(latlngs, {
        color: TRAIL_COLOR,
        weight: 4,
        opacity: 0.85,
      }).addTo(map);
    }

    for (const m of markers) {
      const latLng = L.latLng(m.latitude, m.longitude);
      bounds.extend(latLng);

      const marker = L.marker(latLng, {
        icon: sellerIcon(m.isOnline, m.sellerId === selectedSellerId),
      });

      const visitLine = m.activeVisitCustomerName
        ? `<br/>Visita: <strong>${escapeHtml(m.activeVisitCustomerName)}</strong>`
        : "";
      const when = m.recordedAt
        ? new Date(m.recordedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
        : "—";

      marker.bindPopup(
        `<strong>${escapeHtml(m.sellerName)}</strong><br/>
        ${m.isOnline ? "Online" : "Offline"} · ${when}
        ${visitLine}
        <br/><a href="${googleMapsSearchUrl(m.latitude, m.longitude, m.sellerName)}" target="_blank" rel="noopener">Abrir no Maps</a>`,
      );

      marker.on("click", () => onSelectSeller(m.sellerId));
      marker.addTo(layer);
    }

    if (bounds.isValid()) {
      if (markers.length === 1 && trail.length < 2) {
        map.setView(bounds.getCenter(), 14);
      } else {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
      }
    }
  }, [markers, selectedSellerId, onSelectSeller, trail]);

  return (
    <div
      ref={containerRef}
      className="h-[min(520px,60vh)] w-full rounded-xl border border-slate-200 bg-slate-100"
    />
  );
}
