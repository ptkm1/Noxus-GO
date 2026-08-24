export type AsaasConfig = {
  apiKey: string;
  baseUrl: string;
  webhookToken: string;
  environment: "sandbox" | "production";
  checkoutUrlPrefix: string;
  landingUrl: string;
  appUrl: string;
  gracePeriodDays: number;
};

export type PaymentGatewayMode = "auto" | "asaas";

export type PublicSiteUrls = {
  landingUrl: string;
  appUrl: string;
};

export function readPaymentGatewayMode(): PaymentGatewayMode {
  const raw = process.env.PAYMENT_GATEWAY?.trim().toLowerCase();
  if (raw === "asaas") return "asaas";
  return "auto";
}

/** Garante sufixo `/v3` exigido pela API REST do Asaas. */
export function normalizeAsaasBaseUrl(raw?: string | null): string {
  const trimmed = raw?.trim() || "https://api-sandbox.asaas.com/v3";
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  if (withoutTrailing.endsWith("/v3")) return withoutTrailing;
  return `${withoutTrailing}/v3`;
}

/** URL pública do painel usada nos callbacks do checkout Asaas (ex.: ngrok em dev). */
export function readCheckoutCallbackAppUrl(): string {
  return (
    process.env.ASAAS_CALLBACK_APP_URL?.trim() ||
    process.env.PEDIXPRO_APP_URL?.trim() ||
    process.env.WEB_PUBLIC_URL?.trim() ||
    process.env.WEB_APP_ORIGIN?.trim() ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

export function readPublicSiteUrls(): PublicSiteUrls {
  const landingUrl = (
    process.env.PEDIXPRO_LANDING_URL?.trim() ||
    process.env.SITE_PUBLIC_URL?.trim() ||
    "http://localhost:3001"
  ).replace(/\/$/, "");

  const appUrl = (
    process.env.PEDIXPRO_APP_URL?.trim() ||
    process.env.WEB_PUBLIC_URL?.trim() ||
    process.env.WEB_APP_ORIGIN?.trim() ||
    "http://localhost:5173"
  ).replace(/\/$/, "");

  return { landingUrl, appUrl };
}

export function readAsaasConfig(): AsaasConfig | null {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = normalizeAsaasBaseUrl(process.env.ASAAS_BASE_URL);

  const environment =
    process.env.ASAAS_ENVIRONMENT?.trim() === "production"
      ? "production"
      : "sandbox";

  const checkoutUrlPrefix = (
    process.env.ASAAS_CHECKOUT_URL_PREFIX?.trim() ||
    (environment === "production"
      ? "https://asaas.com/checkoutSession/show"
      : "https://sandbox.asaas.com/checkoutSession/show")
  ).replace(/\/$/, "");

  const { landingUrl, appUrl } = readPublicSiteUrls();

  const graceRaw = Number(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS ?? "7");
  const gracePeriodDays =
    Number.isFinite(graceRaw) && graceRaw >= 0 ? graceRaw : 7;

  return {
    apiKey,
    baseUrl,
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN?.trim() || "",
    environment,
    checkoutUrlPrefix,
    landingUrl,
    appUrl,
    gracePeriodDays,
  };
}

export function isAllowedAsaasCheckoutUrl(
  url: string,
  checkoutUrlPrefix: string,
): boolean {
  try {
    const u = new URL(url);
    const prefix = new URL(
      checkoutUrlPrefix.includes("://")
        ? checkoutUrlPrefix
        : `https://${checkoutUrlPrefix}`,
    );
    return u.hostname === prefix.hostname || u.hostname.endsWith(".asaas.com");
  } catch {
    return false;
  }
}
