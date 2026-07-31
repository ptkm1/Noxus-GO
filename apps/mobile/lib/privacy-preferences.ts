import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCATION_TRACKING_KEY = "pedixpro_location_tracking_enabled";
const PUSH_NOTIFICATIONS_KEY = "pedixpro_push_notifications_enabled";

export type PrivacyPreferences = {
  locationTrackingEnabled: boolean;
  pushNotificationsEnabled: boolean;
};

type Listener = () => void;

const listeners = new Set<Listener>();

export const PRIVACY_LINKS = {
  privacyPolicy: "https://pedixpro.com.br/privacidade",
  terms: "https://pedixpro.com.br/termos",
  accountDeletion:
    "mailto:suporte@pedixpro.com.br?subject=Solicitar%20exclus%C3%A3o%20de%20conta%20PedixPro",
};

async function readBool(key: string): Promise<boolean> {
  return (await AsyncStorage.getItem(key)) === "true";
}

async function writeBool(key: string, value: boolean): Promise<void> {
  await AsyncStorage.setItem(key, value ? "true" : "false");
}

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribePrivacyPreferences(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getPrivacyPreferences(): Promise<PrivacyPreferences> {
  const [locationTrackingEnabled, pushNotificationsEnabled] =
    await Promise.all([
      readBool(LOCATION_TRACKING_KEY),
      readBool(PUSH_NOTIFICATIONS_KEY),
    ]);

  return {
    locationTrackingEnabled,
    pushNotificationsEnabled,
  };
}

export async function isLocationTrackingEnabled(): Promise<boolean> {
  return readBool(LOCATION_TRACKING_KEY);
}

export async function setLocationTrackingEnabled(value: boolean): Promise<void> {
  await writeBool(LOCATION_TRACKING_KEY, value);
  emitChange();
}

export async function isPushNotificationsEnabled(): Promise<boolean> {
  return readBool(PUSH_NOTIFICATIONS_KEY);
}

export async function setPushNotificationsEnabled(value: boolean): Promise<void> {
  await writeBool(PUSH_NOTIFICATIONS_KEY, value);
  emitChange();
}
