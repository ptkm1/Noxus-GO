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

export function readAsaasConfig(): AsaasConfig | null {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (
    process.env.ASAAS_BASE_URL?.trim() || "https://api-sandbox.asaas.com/v3"
  ).replace(/\/$/, "");

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
