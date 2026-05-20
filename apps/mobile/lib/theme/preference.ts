import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemePreference } from "./types";

const STORAGE_KEY = "@pedidos/theme-preference";

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

export async function saveThemePreference(value: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, value);
}
