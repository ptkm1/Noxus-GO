import { API_PREFIX } from "@pedidos/shared";

/** Ngrok free: evita página HTML de aviso em fetch / APIs. */
function applyTunnelHeaders(h: Headers, absoluteUrl: string) {
  if (/ngrok(-free)?\.app/i.test(absoluteUrl)) {
    h.set("ngrok-skip-browser-warning", "true");
  }
}

function baseUrl(): string {
  const env = import.meta.env.VITE_API_URL;
  if (env) return env.replace(/\/$/, "");
  return "";
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl()}${API_PREFIX}${p}`;
}

const ACCESS = "pedidos_access";
const REFRESH = "pedidos_refresh";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS, access);
  localStorage.setItem(REFRESH, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH);
}

type Opt = RequestInit & { skipAuth?: boolean };

export async function apiFetch<T>(path: string, opts: Opt = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = opts;
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  if (!skipAuth) {
    const t = getAccessToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }

  const reqUrl = apiUrl(path);
  applyTunnelHeaders(h, reqUrl);
  let res = await fetch(reqUrl, { ...rest, headers: h });

  if (res.status === 401 && !skipAuth && getRefreshToken()) {
    const refreshUrl = apiUrl("/auth/refresh");
    const rh = new Headers({ "Content-Type": "application/json" });
    applyTunnelHeaders(rh, refreshUrl);
    const r = await fetch(refreshUrl, {
      method: "POST",
      headers: rh,
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    });
    if (r.ok) {
      const data = (await r.json()) as { accessToken: string };
      localStorage.setItem(ACCESS, data.accessToken);
      h.set("Authorization", `Bearer ${data.accessToken}`);
      applyTunnelHeaders(h, reqUrl);
      res = await fetch(reqUrl, { ...rest, headers: h });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function downloadPdf(pathWithQuery: string, filename: string) {
  const h = new Headers();
  const t = getAccessToken();
  if (t) h.set("Authorization", `Bearer ${t}`);
  const pdfUrl = apiUrl(pathWithQuery);
  applyTunnelHeaders(h, pdfUrl);
  const res = await fetch(pdfUrl, { headers: h });
  if (!res.ok) throw new Error("Falha ao gerar PDF");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
