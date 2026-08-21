import { API_PREFIX } from "@pedidos/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  getCachedApiBaseOverride,
  normalizeApiBaseInput,
} from "./devtools/api-base-override";

const ACCESS = "pedidos_access";
const REFRESH = "pedidos_refresh";

function applyTunnelHeaders(h: Headers, absoluteUrl: string) {
  if (/ngrok(-free)?\.app/i.test(absoluteUrl)) {
    h.set("ngrok-skip-browser-warning", "true");
  }
}

/** Default base when no DevTools override and no EXPO_PUBLIC_API_URL. */
export function defaultApiBaseWithoutOverride(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return normalizeApiBaseInput(fromEnv);
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  if (extra?.apiUrl) return normalizeApiBaseInput(extra.apiUrl);
  if (!__DEV__) {
    throw new Error("EXPO_PUBLIC_API_URL precisa estar configurada em builds de produção.");
  }
  if (Platform.OS === "android") return "http://10.0.2.2:4000";
  return "http://localhost:4000";
}

/** DevTools override wins, then env / platform default. */
export function apiBase(): string {
  const override = getCachedApiBaseOverride();
  if (override) return normalizeApiBaseInput(override);
  return defaultApiBaseWithoutOverride();
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
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      issues?: Array<{ code?: string; message: string }>;
    };
    const fromIssues = err.issues
      ?.map((i) => (i.code ? `${i.code}: ${i.message}` : i.message))
      .join("\n");
    throw new Error(fromIssues || err.error || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Baixa PDF autenticado e abre o sheet de compartilhar / impressão do SO. */
export async function sharePdf(path: string, filename: string) {
  const FileSystem = await import("expo-file-system/legacy");
  const Sharing = await import("expo-sharing");

  const token = await getAccessToken();
  const url = apiUrl(path);
  const dest = `${FileSystem.cacheDirectory ?? ""}${filename}`;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (/ngrok(-free)?\.app/i.test(url)) {
    headers["ngrok-skip-browser-warning"] = "true";
  }

  const download = FileSystem.createDownloadResumable(url, dest, { headers });
  const result = await download.downloadAsync();
  if (!result?.uri) throw new Error("Falha ao gerar PDF");

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Compartilhamento não disponível neste dispositivo.");
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: filename,
    UTI: "com.adobe.pdf",
  });
}
