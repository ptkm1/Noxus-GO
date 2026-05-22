import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { SellerTrackingMap, type SellerMapMarker } from "../components/SellerTrackingMap";
import { useLiveSellerTrailFromWs } from "../hooks/useLiveSellerTrailFromWs";
import { useSellerLocationsWs } from "../hooks/useSellerLocationsWs";
import { apiFetch } from "../lib/api";
import { isGoogleMapsConfigured } from "../lib/google-maps-config";
import { isLiveTrackWsPolylineEnabled } from "../lib/maps-features";
import { googleMapsSearchUrl } from "../lib/maps-links";

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

type MapsFeatures = {
  googleRoutesEnabled: boolean;
  googleRoutesHasApiKey: boolean;
  googleRoutesDailyMaxPerOrg: number;
  googleRoutesDailyMaxGlobal: number;
  googleRoutesRemaining: number;
  googleRoutesQuotaAllowed: boolean;
  googleRoutesQuotaReason: string | null;
};

type Payload = {
  onlineThresholdMinutes: number;
  mapsFeatures?: MapsFeatures;
  sellers: SellerLocationRow[];
};

type HistoryPayload = {
  date: string;
  points: { lat: number; lng: number; recordedAt: string }[];
  trailPolyline: { lat: number; lng: number }[];
  trailSource: "google_routes" | "gps_line";
  simplified: boolean;
  distanceMeters: number;
  roadDistanceMeters: number | null;
  roadRoutingConfigured?: boolean;
  mapsFeatures?: MapsFeatures;
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "Sem posição";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDistance(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function SellerTrackingPage() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTrail, setShowTrail] = useState(false);
  const [trailDate, setTrailDate] = useState(todayIso);

  const historyQ = useQuery({
    queryKey: ["admin", "seller-location-history", selectedId, trailDate],
    queryFn: () =>
      apiFetch<HistoryPayload>(
        `/admin/sellers/${selectedId}/location-history?date=${encodeURIComponent(trailDate)}`,
      ),
    enabled: Boolean(selectedId && showTrail),
  });

  const historySeedPoints = useMemo(() => {
    if (!showTrail || !historyQ.data?.points?.length) return undefined;
    return historyQ.data.points.map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [showTrail, historyQ.data]);

  const { liveTrail, onSellerLocation } = useLiveSellerTrailFromWs(selectedId, historySeedPoints);
  const { connected: wsConnected } = useSellerLocationsWs(true, { onSellerLocation });

  const q = useQuery({
    queryKey: ["admin", "seller-locations"],
    queryFn: () => apiFetch<Payload>("/admin/seller-locations"),
    refetchInterval: wsConnected ? 60_000 : 15_000,
    staleTime: 5_000,
  });

  const sellers = q.data?.sellers ?? [];
  const onlineCount = sellers.filter((s) => s.isOnline).length;
  const withGps = sellers.filter((s) => s.latitude != null && s.longitude != null);

  const mapMarkers: SellerMapMarker[] = useMemo(
    () =>
      withGps.map((s) => ({
        sellerId: s.sellerId,
        sellerName: s.sellerName,
        latitude: s.latitude!,
        longitude: s.longitude!,
        isOnline: s.isOnline,
        activeVisitCustomerName: s.activeVisit?.customerName ?? null,
        recordedAt: s.recordedAt,
      })),
    [withGps],
  );

  const trail = useMemo(() => {
    if (!showTrail || !historyQ.data) return [];
    const line =
      historyQ.data.trailPolyline?.length >= 2
        ? historyQ.data.trailPolyline
        : historyQ.data.points;
    return line.map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [showTrail, historyQ.data]);

  const selected = sellers.find((s) => s.sellerId === selectedId) ?? null;
  const isManager = user?.role === "MANAGER";
  const mapsFeatures = historyQ.data?.mapsFeatures ?? q.data?.mapsFeatures;
  const liveTrailOn = isLiveTrackWsPolylineEnabled();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Rastreio em tempo real</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Posição enviada pelo app do vendedor (primeiro plano e, com permissão, em segundo plano).
          Mapa: {isGoogleMapsConfigured() ? "Google Maps" : "OpenStreetMap (configure a chave Google)"}.
          Online = GPS nos últimos {q.data?.onlineThresholdMinutes ?? 5} minutos.
          {wsConnected ? (
            <span className="ml-1 font-medium text-success">· Ao vivo (WebSocket)</span>
          ) : (
            <span className="ml-1 text-muted-foreground">· Atualização periódica (reconectando…)</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>
          {isManager ? "Equipe ativa" : "Vendedores ativos"}:{" "}
          <strong className="text-foreground">{sellers.length}</strong>
        </span>
        <span>
          Online: <strong className="text-success">{onlineCount}</strong>
        </span>
        <span>
          Com GPS no mapa: <strong className="text-foreground">{withGps.length}</strong>
        </span>
        <span className="text-muted-foreground">
          {q.isFetching ? "Atualizando…" : `Última leitura: ${new Date().toLocaleTimeString("pt-BR")}`}
        </span>
      </div>

      {isManager && sellers.length === 0 && !q.isLoading ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Nenhum vendedor na sua equipe. Peça ao administrador para associar vendedores ao seu perfil de
          gestor.
        </div>
      ) : null}

      {q.isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar as posições dos vendedores.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
        <div className="max-h-[min(520px,60vh)] overflow-y-auto rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {sellers.length === 0 && !q.isLoading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                {isManager ? "Nenhum vendedor na equipe." : "Nenhum vendedor ativo."}
              </li>
            ) : null}
            {sellers.map((s) => (
              <li key={s.sellerId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.sellerId)}
                  className={`w-full px-4 py-3 text-left transition hover:bg-background ${
                    selectedId === s.sellerId ? "bg-sky-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{s.sellerName}</p>
                      <p className="text-xs text-muted-foreground">{fmtWhen(s.recordedAt)}</p>
                      {s.activeVisit ? (
                        <p className="mt-1 text-xs font-medium text-warning">
                          Em visita: {s.activeVisit.customerName}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        s.isOnline ? "bg-success" : "bg-muted"
                      }`}
                      title={s.isOnline ? "Online" : "Offline"}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <SellerTrackingMap
            markers={mapMarkers}
            selectedSellerId={selectedId}
            onSelectSeller={setSelectedId}
            trail={trail}
            liveTrail={liveTrailOn ? liveTrail : []}
          />

          {selected ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">
              <p className="font-semibold text-foreground">{selected.sellerName}</p>
              <p className="mt-1 text-muted-foreground">{selected.sellerEmail}</p>
              <p className="mt-2">
                Estado:{" "}
                <strong className={selected.isOnline ? "text-success" : "text-muted-foreground"}>
                  {selected.isOnline ? "Online" : "Offline"}
                </strong>
                {" · "}
                {fmtWhen(selected.recordedAt)}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showTrail}
                    onChange={(e) => setShowTrail(e.target.checked)}
                  />
                  Mostrar trajeto
                </label>
                {showTrail ? (
                  <input
                    type="date"
                    className="rounded border border-border px-2 py-1 text-sm"
                    value={trailDate}
                    max={todayIso()}
                    onChange={(e) => setTrailDate(e.target.value)}
                  />
                ) : null}
              </div>

              {showTrail && historyQ.isLoading ? (
                <p className="mt-2 text-xs text-muted-foreground">Carregando trajeto…</p>
              ) : null}
              {showTrail && historyQ.data && historyQ.data.points.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {historyQ.data.points.length} amostra(s) GPS
                  {historyQ.data.simplified ? " (reduzidas)" : ""}
                  {" · "}
                  {historyQ.data.trailSource === "google_routes" ? (
                    <>
                      Trajeto por estrada ~
                      {formatDistance(historyQ.data.roadDistanceMeters ?? historyQ.data.distanceMeters)}
                    </>
                  ) : (
                    <>
                      Linha reta entre pontos ~
                      {formatDistance(historyQ.data.distanceMeters)}
                      {historyQ.data.trailSource === "gps_line" &&
                      historyQ.data.mapsFeatures &&
                      !historyQ.data.mapsFeatures.googleRoutesQuotaAllowed
                        ? ` (${historyQ.data.mapsFeatures.googleRoutesQuotaReason ?? "Google Routes desativado"})`
                        : ""}
                    </>
                  )}
                  {" · "}
                  {new Date(historyQ.data.points[0]!.recordedAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  →{" "}
                  {new Date(
                    historyQ.data.points[historyQ.data.points.length - 1]!.recordedAt,
                  ).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              ) : null}
              {showTrail && historyQ.data && historyQ.data.points.length === 0 ? (
                <p className="mt-2 text-xs text-warning">Sem pontos de trajeto nesta data.</p>
              ) : null}

              {showTrail && mapsFeatures ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Google Routes:{" "}
                  {mapsFeatures.googleRoutesEnabled
                    ? mapsFeatures.googleRoutesQuotaAllowed
                      ? `${mapsFeatures.googleRoutesRemaining} pedido(s) restante(s) hoje (limite ${mapsFeatures.googleRoutesDailyMaxPerOrg}/org)`
                      : mapsFeatures.googleRoutesQuotaReason ?? "sem cota"
                    : "desligado (GOOGLE_ROUTES_ENABLED=false)"}
                </p>
              ) : null}

              {liveTrailOn && selected ? (
                <p className="mt-2 text-xs text-violet-800">
                  Trajeto ao vivo (GPS): {liveTrail.length >= 2 ? `${liveTrail.length} pontos` : "aguardando pings…"}
                </p>
              ) : null}

              {selected.activeVisit ? (
                <p className="mt-2">
                  Visita em curso em <strong>{selected.activeVisit.customerName}</strong> desde{" "}
                  {new Date(selected.activeVisit.checkedInAt).toLocaleString("pt-BR")}
                </p>
              ) : null}
              {selected.latitude != null && selected.longitude != null ? (
                <p className="mt-3">
                  <a
                    href={googleMapsSearchUrl(
                      selected.latitude,
                      selected.longitude,
                      selected.sellerName,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sky-700 hover:underline"
                  >
                    Abrir posição no Google Maps
                  </a>
                </p>
              ) : (
                <p className="mt-2 text-warning">
                  Ainda sem GPS — o vendedor precisa abrir o app mobile com localização permitida.
                </p>
              )}
              <p className="mt-3">
                <Link to="/visitas" className="font-medium text-sky-700 hover:underline">
                  Ver histórico de visitas →
                </Link>
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-success" /> Online
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground" /> Offline / sem sinal recente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-6 rounded bg-sky-600" /> Trajeto do dia
            </span>
            {liveTrailOn ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-6 border-t-2 border-dashed border-violet-600"
                  aria-hidden
                />
                Trajeto ao vivo (GPS)
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
