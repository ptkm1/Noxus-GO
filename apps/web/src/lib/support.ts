import { LEGAL_CONTACT_EMAIL } from "@pedidos/shared";

/**
 * Canais de suporte Pedix Pro.
 * WhatsApp: defina o número E.164 sem `+` (ex.: 5511999999999) quando houver canal oficial.
 */
export const SUPPORT_EMAIL = LEGAL_CONTACT_EMAIL;

/** Placeholder — substituir pelo número oficial do suporte. */
export const SUPPORT_WHATSAPP_E164: string | null = null;

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Suporte Pedix Pro")}`;

export function supportWhatsAppUrl(): string | null {
  if (!SUPPORT_WHATSAPP_E164) return null;
  const text = encodeURIComponent("Olá! Preciso de ajuda com o Pedix Pro.");
  return `https://wa.me/${SUPPORT_WHATSAPP_E164}?text=${text}`;
}
