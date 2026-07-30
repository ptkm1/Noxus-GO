/**
 * Templates HTML transacionais PedixPro (cores alinhadas ao painel web).
 * Primary light: #02445C | dark teal header: #084255 | fundo: #F8FAFC
 */

import { escapeHtml } from "./email-send.js";

const BRAND = {
  primary: "#02445C",
  primaryDark: "#084255",
  primaryHover: "#0a5a70",
  background: "#F8FAFC",
  card: "#ffffff",
  text: "#111827",
  muted: "#64748b",
  border: "#E2E8F0",
  name: "PedixPro",
} as const;

export type BrandEmailContent = {
  preheader?: string;
  title: string;
  greeting?: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  footerNote?: string;
  /** Linhas extras no rodapé (já escapadas ou texto puro). */
  metaLines?: string[];
};

function formatExpiresLabel(expiresAt: Date): string {
  return expiresAt.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

/** Layout responsivo table-based (clientes de e-mail). */
export function renderBrandEmailHtml(content: BrandEmailContent): string {
  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(content.preheader)}</div>`
    : "";

  const greeting = content.greeting
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${BRAND.text};">Olá, <strong>${escapeHtml(content.greeting)}</strong>,</p>`
    : "";

  const paragraphs = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.text};">${p}</p>`,
    )
    .join("");

  const meta =
    content.metaLines
      ?.map(
        (line) =>
          `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${BRAND.muted};">${line}</p>`,
      )
      .join("") ?? "";

  const footerNote = content.footerNote
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:${BRAND.muted};">${escapeHtml(content.footerNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${escapeHtml(content.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.background};-webkit-text-size-adjust:100%;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};">
          <tr>
            <td style="background:${BRAND.primaryDark};padding:28px 32px;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">
                ${BRAND.name}
              </p>
              <p style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;color:rgba(255,255,255,0.72);">
                Pedidos &amp; vendas
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;line-height:1.3;color:${BRAND.primaryDark};">
                ${escapeHtml(content.title)}
              </h1>
              ${greeting}
              ${paragraphs}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
                <tr>
                  <td style="border-radius:8px;background:${BRAND.primary};">
                    <a href="${escapeHtml(content.ctaUrl)}"
                       style="display:inline-block;padding:14px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      ${escapeHtml(content.ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>
              ${meta}
              ${footerNote}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid ${BRAND.border};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:${BRAND.muted};">
              Este e-mail foi enviado automaticamente pelo ${BRAND.name}. Não responda a esta mensagem.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function ownerActivationEmailContent(params: {
  adminName: string;
  companyName: string;
  planName: string;
  activateUrl: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  const expiresLabel = formatExpiresLabel(params.expiresAt);
  const html = renderBrandEmailHtml({
    preheader: "Pagamento confirmado — defina sua senha e acesse o PedixPro.",
    title: "Sua conta está pronta",
    greeting: params.adminName,
    paragraphs: [
      `Confirmamos o pagamento e ativamos sua organização <strong>${escapeHtml(params.companyName)}</strong> no PedixPro (plano <strong>${escapeHtml(params.planName)}</strong>).`,
      "Para começar, defina sua senha de administrador. Depois você poderá acessar o painel, cadastrar produtos e convidar a equipe.",
    ],
    ctaLabel: "Definir senha e acessar",
    ctaUrl: params.activateUrl,
    metaLines: [
      `Este link é válido até <strong>${escapeHtml(expiresLabel)}</strong> (horário de Brasília).`,
    ],
    footerNote:
      "Se você não solicitou esta conta, ignore este e-mail. Nenhuma ação será tomada.",
  });
  return { subject: "Sua conta PedixPro está ativa — defina sua senha", html };
}

export function userInviteEmailContent(params: {
  name: string;
  companyName: string;
  activateUrl: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  const expiresLabel = formatExpiresLabel(params.expiresAt);
  const html = renderBrandEmailHtml({
    preheader: `Convite para ${params.companyName} no PedixPro.`,
    title: "Você foi convidado",
    greeting: params.name,
    paragraphs: [
      `Você foi convidado(a) para a organização <strong>${escapeHtml(params.companyName)}</strong> no PedixPro.`,
      "Defina sua senha para acessar o sistema.",
    ],
    ctaLabel: "Definir senha e acessar",
    ctaUrl: params.activateUrl,
    metaLines: [
      `Link válido até <strong>${escapeHtml(expiresLabel)}</strong> (horário de Brasília).`,
    ],
    footerNote:
      "Se você não esperava este convite, ignore este e-mail.",
  });
  return { subject: "Convite PedixPro — defina sua senha", html };
}

export function passwordResetEmailContent(params: {
  name: string;
  resetUrl: string;
  expiresAt: Date;
}): { subject: string; html: string } {
  const expiresLabel = formatExpiresLabel(params.expiresAt);
  const html = renderBrandEmailHtml({
    preheader: "Redefina sua senha do PedixPro.",
    title: "Redefinir senha",
    greeting: params.name,
    paragraphs: [
      "Recebemos um pedido para redefinir a senha da sua conta PedixPro.",
      "Clique no botão abaixo para escolher uma nova senha. Se você não fez este pedido, ignore este e-mail — sua senha atual permanece inalterada.",
    ],
    ctaLabel: "Redefinir senha",
    ctaUrl: params.resetUrl,
    metaLines: [
      `Este link é válido até <strong>${escapeHtml(expiresLabel)}</strong> (horário de Brasília) e pode ser usado apenas uma vez.`,
    ],
    footerNote:
      "Por segurança, nunca compartilhe este link. A equipe PedixPro nunca pede sua senha por e-mail.",
  });
  return { subject: "PedixPro — redefinir senha", html };
}

/** URL pública do painel web (links de e-mail). */
export function resolveWebAppPublicUrl(): string {
  return (
    process.env.PEDIXPRO_APP_URL?.trim() ||
    process.env.WEB_PUBLIC_URL?.trim() ||
    process.env.WEB_APP_ORIGIN?.trim() ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}
