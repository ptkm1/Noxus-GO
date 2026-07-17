/** Cloudflare WAF da Brasil API bloqueia fetch do Node sem User-Agent explícito. */
export const BRASIL_API_USER_AGENT = "CommercePro/1.0 (+https://brasilapi.com.br)";

export function brasilApiHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent": BRASIL_API_USER_AGENT,
  };
}
