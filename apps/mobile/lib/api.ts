import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { API_PREFIX } from "@pedidos/shared";

const ACCESS = "pedidos_access";
const REFRESH = "pedidos_refresh";

function applyTunnelHeaders(h: Headers, absoluteUrl: string) {
  if (/ngrok(-free)?\.app/i.test(absoluteUrl)) {
    h.set("ngrok-skip-browser-warning", "true");
  }
}

/**
 * Emulador Android: localhost é o próprio emulador — a API no Mac/PC é 10.0.2.2.
 * Simulador iOS: localhost costuma apontar para a máquina host.
 * Dispositivo físico: define EXPO_PUBLIC_API_URL=http://IP_DA_TUA_REDE:4000
 */
function normalizeApiBase(raw: string): string {
  let base = raw.replace(/\/$/, "");
  // Emulador Android: .env com localhost aponta para o próprio emulador; trocar pelo host.
  if (Platform.OS === "android") {
    base = base.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?/i, (_, proto, _h, port) => {
      return `${proto}10.0.2.2${port ?? ""}`;
    });
  }
  return base;
}

export function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return normalizeApiBase(fromEnv);
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  if (extra?.apiUrl) return normalizeApiBase(extra.apiUrl);
  if (Platform.OS === "android") return "http://10.0.2.2:4000";
  return "http://localhost:4000";
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase()}${API_PREFIX}${p}`;
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS);
}

export async function setTokens(access: string, refresh: string) {
  await AsyncStorage.multiSet([
    [ACCESS, access],
    [REFRESH, refresh],
  ]);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS, REFRESH]);
}

async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH);
}

type Opt = RequestInit & { skipAuth?: boolean };

export async function apiFetch<T>(path: string, opts: Opt = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = opts;
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  if (!skipAuth) {
    const t = await getAccessToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }

  const url = apiUrl(path);
  applyTunnelHeaders(h, url);
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers: h });
  } catch (e) {
    const base = apiBase();
    const hint =
      Platform.OS === "android"
        ? `Sem ligação à API em ${base}. Arranca a API (pnpm dev:api). Em telemóvel físico usa EXPO_PUBLIC_API_URL=http://IP_DO_TEU_PC:4000`
        : `Sem ligação à API em ${base}. Arranca a API (pnpm dev:api).`;
    throw new Error(e instanceof Error ? `${hint} (${e.message})` : hint);
  }

  if (res.status === 401 && !skipAuth && (await getRefreshToken())) {
    let r: Response;
    try {
      const refreshUrl = apiUrl("/auth/refresh");
      const rh = new Headers({ "Content-Type": "application/json" });
      applyTunnelHeaders(rh, refreshUrl);
      r = await fetch(refreshUrl, {
        method: "POST",
        headers: rh,
        body: JSON.stringify({ refreshToken: await getRefreshToken() }),
      });
    } catch {
      throw new Error("Refresh falhou — verifica se a API está acessível.");
    }
    if (r.ok) {
      const data = (await r.json()) as { accessToken: string };
      await AsyncStorage.setItem(ACCESS, data.accessToken);
      h.set("Authorization", `Bearer ${data.accessToken}`);
      applyTunnelHeaders(h, url);
      try {
        res = await fetch(url, { ...rest, headers: h });
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "Pedido falhou");
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
