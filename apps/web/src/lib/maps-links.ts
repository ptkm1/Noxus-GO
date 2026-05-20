/** Abre coordenadas no Google Maps (web). */
export function googleMapsSearchUrl(lat: number, lng: number, label?: string): string {
  const q = label ? `${lat},${lng} (${label})` : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function fmtCoord(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
