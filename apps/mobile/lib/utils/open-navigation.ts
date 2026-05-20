import { Linking, Platform } from "react-native";

export type NavigationApp = "google" | "waze";

function encodeLabel(label?: string): string {
  return encodeURIComponent(label?.trim() || "Cliente");
}

/** Abre Google Maps / Apple Maps com destino nas coordenadas do cliente. */
export async function openGoogleMapsNavigation(
  latitude: number,
  longitude: number,
  label?: string,
): Promise<void> {
  const q = `${latitude},${longitude}`;
  const name = encodeLabel(label);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${q}&q=${name}`
      : `https://www.google.com/maps/dir/?api=1&destination=${q}&destination_place_id=&travelmode=driving`;
  await Linking.openURL(url);
}

/** Abre o Waze com destino (instalação necessária no aparelho). */
export async function openWazeNavigation(latitude: number, longitude: number): Promise<void> {
  const url = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
  const can = await Linking.canOpenURL(url);
  if (!can) {
    throw new Error("Waze não está instalado neste aparelho.");
  }
  await Linking.openURL(url);
}

export async function openNavigationApp(
  app: NavigationApp,
  latitude: number,
  longitude: number,
  label?: string,
): Promise<void> {
  if (app === "waze") {
    await openWazeNavigation(latitude, longitude);
  } else {
    await openGoogleMapsNavigation(latitude, longitude, label);
  }
}
