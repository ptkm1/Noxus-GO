/** Distância em km entre dois pontos WGS84 (fórmula de Haversine). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type GeoStop = { id: string; lat: number; lng: number };

/** Ordem heurística “vizinho mais próximo” a partir da origem (não é TSP ótimo; não usa estradas). */
export function greedyNearestRoute(
  originLat: number,
  originLng: number,
  stops: GeoStop[],
): { orderedIds: string[]; legKm: number[]; totalKm: number } {
  const remaining = [...stops];
  const orderedIds: string[] = [];
  const legKm: number[] = [];
  let curLat = originLat;
  let curLng = originLng;
  let totalKm = 0;

  while (remaining.length > 0) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(curLat, curLng, remaining[i].lat, remaining[i].lng);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const next = remaining.splice(bestI, 1)[0]!;
    legKm.push(Math.round(bestD * 1000) / 1000);
    totalKm += bestD;
    orderedIds.push(next.id);
    curLat = next.lat;
    curLng = next.lng;
  }

  return {
    orderedIds,
    legKm,
    totalKm: Math.round(totalKm * 1000) / 1000,
  };
}
