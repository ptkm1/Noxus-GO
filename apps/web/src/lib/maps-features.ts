/** Trajeto GPS acumulado a cada ping WebSocket (sem Google Routes). */
export function isLiveTrackWsPolylineEnabled(): boolean {
  const raw = import.meta.env.VITE_LIVE_TRACK_WS_POLYLINE_ENABLED?.trim().toLowerCase();
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw);
}
