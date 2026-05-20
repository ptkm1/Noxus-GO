/** Chave Maps JavaScript API (painel web). Pode ser a mesma do mobile no monorepo. */
export function getGoogleMapsApiKey(): string | undefined {
  const vite = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (vite) return vite;
  const expo = import.meta.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return expo || undefined;
}

export function isGoogleMapsConfigured(): boolean {
  return !!getGoogleMapsApiKey();
}
