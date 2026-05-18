import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "pedidos_catalog_favorites_v1";

export async function loadFavoriteIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export async function saveFavoriteIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/** Alterna favorito e devolve a nova lista de IDs. */
export async function toggleFavoriteId(id: string): Promise<string[]> {
  const cur = await loadFavoriteIds();
  const nextSet = new Set(cur);
  if (nextSet.has(id)) nextSet.delete(id);
  else nextSet.add(id);
  const next = [...nextSet];
  await saveFavoriteIds(next);
  return next;
}
