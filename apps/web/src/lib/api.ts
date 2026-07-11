import { API_PREFIX } from "@pedidos/shared";
import { errorFromResponse } from "./api-error";

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
  const { skipAuth, headers, body, method, ...rest } = opts;
  const h = new Headers(headers);
  const m = (method ?? "GET").toUpperCase();
  let reqBody = body;
  if (reqBody !== undefined) {
    h.set("Content-Type", "application/json");
  } else if (m === "POST" || m === "PUT" || m === "PATCH") {
    reqBody = JSON.stringify({});
    h.set("Content-Type", "application/json");
  }
  if (!skipAuth) {
    const t = getAccessToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }

  const reqUrl = apiUrl(path);
  applyTunnelHeaders(h, reqUrl);
  let res = await fetch(reqUrl, { ...rest, method: m, body: reqBody, headers: h });

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
      res = await fetch(reqUrl, { ...rest, method: m, body: reqBody, headers: h });
    }
  }

  if (!res.ok) {
    throw await errorFromResponse(res);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function downloadPdf(pathWithQuery: string, filename: string) {
  const blob = await fetchPdfBlob(pathWithQuery);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchPdfBlob(pathWithQuery: string): Promise<Blob> {
  const h = new Headers();
  const t = getAccessToken();
  if (t) h.set("Authorization", `Bearer ${t}`);
  const pdfUrl = apiUrl(pathWithQuery);
  applyTunnelHeaders(h, pdfUrl);
  const res = await fetch(pdfUrl, { headers: h });
  if (!res.ok) throw await errorFromResponse(res);
  return res.blob();
}

/** Abre o diálogo de impressão do navegador com o PDF do pedido. */
export async function printPdf(pathWithQuery: string) {
  const blob = await fetchPdfBlob(pathWithQuery);
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };
}
