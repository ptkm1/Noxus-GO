import { apiFetch } from "./api";
import { isNetworkError } from "./network-error";

type FetchWithOfflineCacheOptions<T> = {
  url: string;
  readCache: () => Promise<T | null>;
  writeCache: (data: T) => Promise<unknown>;
};

/**
 * Tenta a API; em sucesso grava cache. Em erro de rede, devolve cache local se existir.
 */
export async function fetchWithOfflineCache<T>(
  opts: FetchWithOfflineCacheOptions<T>,
): Promise<T> {
  try {
    const data = await apiFetch<T>(opts.url);
    try {
      await opts.writeCache(data);
    } catch {
      /* cache write best-effort */
    }
    return data;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    const cached = await opts.readCache();
    if (cached != null) return cached;
    throw e;
  }
}
