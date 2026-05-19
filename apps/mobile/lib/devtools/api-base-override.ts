import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const API_BASE_OVERRIDE_KEY = "pedidos_dev_api_base_override";

/** In-memory cache so `apiBase()` stays synchronous after bootstrap. */
let cachedOverride: string | null = null;
let bootstrapDone = false;

export function isApiBaseOverrideBootstrapped(): boolean {
  return bootstrapDone;
}

export function getCachedApiBaseOverride(): string | null {
  return cachedOverride;
}

export async function bootstrapApiBaseOverride(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(API_BASE_OVERRIDE_KEY);
  cachedOverride = raw?.trim() ? raw.trim() : null;
  bootstrapDone = true;
  return cachedOverride;
}

export function normalizeApiBaseInput(raw: string): string {
  let base = raw.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(base)) {
    base = `http://${base}`;
  }
  if (Platform.OS === "android") {
    base = base.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?/i, (_, proto, _h, port) => {
      return `${proto}10.0.2.2${port ?? ""}`;
    });
  }
  return base;
}

export async function getApiBaseOverride(): Promise<string | null> {
  if (!bootstrapDone) await bootstrapApiBaseOverride();
  return cachedOverride;
}

export async function setApiBaseOverride(raw: string | null): Promise<void> {
  if (!raw?.trim()) {
    await AsyncStorage.removeItem(API_BASE_OVERRIDE_KEY);
    cachedOverride = null;
    bootstrapDone = true;
    return;
  }
  const normalized = normalizeApiBaseInput(raw);
  await AsyncStorage.setItem(API_BASE_OVERRIDE_KEY, normalized);
  cachedOverride = normalized;
  bootstrapDone = true;
}

export async function testApiBaseConnection(base: string): Promise<{ ok: boolean; message: string }> {
  const normalized = normalizeApiBaseInput(base);
  const url = `${normalized}/health`;
  const headers: Record<string, string> = {};
  if (/ngrok(-free)?\.app/i.test(url)) {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  try {
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status} em ${url}` };
    }
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    if (body?.ok === true) {
      return { ok: true, message: `OK · ${url}` };
    }
    return { ok: true, message: `Respondeu · ${url}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha de rede";
    return { ok: false, message: `${msg} (${url})` };
  }
}
