import { PaymentGatewayError } from "../payment-gateway.js";
import type { AsaasConfig } from "./asaas-config.js";

const TIMEOUT_MS = 60_000;

export async function asaasFetch<T>(
  cfg: AsaasConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        access_token: cfg.apiKey,
        "User-Agent": "PedixPro/1.0",
        ...(init?.headers ?? {}),
      },
    });

    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text.slice(0, 200) };
      }
    }

    if (!res.ok) {
      const msg =
        typeof body === "object" &&
        body &&
        "errors" in body &&
        Array.isArray((body as { errors: unknown }).errors)
          ? JSON.stringify((body as { errors: unknown }).errors).slice(0, 300)
          : `Asaas HTTP ${res.status} (${path})`;
      throw new PaymentGatewayError(msg, "ASAAS_HTTP_ERROR", res.status);
    }

    return body as T;
  } catch (err) {
    if (err instanceof PaymentGatewayError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new PaymentGatewayError("Timeout Asaas", "ASAAS_TIMEOUT", 504);
    }
    throw new PaymentGatewayError(
      err instanceof Error ? err.message : "Falha Asaas",
      "ASAAS_UNAVAILABLE",
      503,
    );
  } finally {
    clearTimeout(timer);
  }
}
