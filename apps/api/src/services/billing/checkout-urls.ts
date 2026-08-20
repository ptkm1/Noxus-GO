import {
    readCheckoutCallbackAppUrl,
    readPublicSiteUrls,
} from "./asaas/asaas-config.js";

export type CheckoutReturnSource = "landing" | "app";

export function nextDueDateIso(from = new Date()): string {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, "0");
  const day = String(from.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function checkoutReturnUrls(
  intentId: string,
  source: CheckoutReturnSource,
): { successUrl: string; cancelUrl: string; expiredUrl: string } {
  const { landingUrl } = readPublicSiteUrls();
  const appUrl = readCheckoutCallbackAppUrl();
  const base =
    source === "app"
      ? `${appUrl}/pagamento?intentId=${intentId}`
      : `${landingUrl}/contratacao/processando?intentId=${intentId}`;
  return {
    successUrl: base,
    cancelUrl: `${base}&result=canceled`,
    expiredUrl: `${base}&result=expired`,
  };
}
