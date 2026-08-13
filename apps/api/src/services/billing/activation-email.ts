import { prisma } from "../../db.js";
import {
  explainEmailSendFailure,
  readEmailOutboundConfig,
  sendTransactionalHtmlEmail,
} from "../email-send.js";
import {
  ownerActivationEmailContent,
  passwordResetEmailContent,
  resolveWebAppPublicUrl,
  userInviteEmailContent,
} from "../email-templates.js";
import { createActivationToken } from "./account-activation.js";

function logEmailFailure(
  kind: string,
  to: string,
  result: { sent: boolean; reason?: string },
): void {
  if (result.sent) return;
  console.warn(
    `[email] ${kind} não enviado para ${to}: ${result.reason ?? "unknown"}`,
  );
}

function notConfigured(
  kind: string,
  to: string,
): { sent: false; reason: string } {
  const result = {
    sent: false as const,
    reason: explainEmailSendFailure("EMAIL_NOT_CONFIGURED"),
  };
  logEmailFailure(kind, to, result);
  return result;
}

export async function sendOwnerActivationEmail(params: {
  to: string;
  adminName: string;
  companyName: string;
  planName: string;
  rawToken: string;
  expiresAt: Date;
}): Promise<{ sent: boolean; reason?: string }> {
  const cfg = readEmailOutboundConfig();
  const appUrl = resolveWebAppPublicUrl();
  const activateUrl = `${appUrl}/ativar-conta?token=${encodeURIComponent(params.rawToken)}`;

  if (!cfg) return notConfigured("owner-activation", params.to);

  const { subject, html } = ownerActivationEmailContent({
    adminName: params.adminName,
    companyName: params.companyName,
    planName: params.planName,
    activateUrl,
    expiresAt: params.expiresAt,
  });

  const sendResult = await sendTransactionalHtmlEmail({
    cfg,
    to: [params.to],
    subject,
    html,
  });

  const result = sendResult.ok
    ? { sent: true as const }
    : { sent: false as const, reason: sendResult.message };
  logEmailFailure("owner-activation", params.to, result);
  return result;
}

export async function sendUserInviteEmail(params: {
  to: string;
  name: string;
  companyName: string;
  rawToken: string;
  expiresAt: Date;
}): Promise<{ sent: boolean; reason?: string }> {
  const cfg = readEmailOutboundConfig();
  const appUrl = resolveWebAppPublicUrl();
  const activateUrl = `${appUrl}/ativar-conta?token=${encodeURIComponent(params.rawToken)}`;

  if (!cfg) return notConfigured("user-invite", params.to);

  const { subject, html } = userInviteEmailContent({
    name: params.name,
    companyName: params.companyName,
    activateUrl,
    expiresAt: params.expiresAt,
  });

  const sendResult = await sendTransactionalHtmlEmail({
    cfg,
    to: [params.to],
    subject,
    html,
  });

  const result = sendResult.ok
    ? { sent: true as const }
    : { sent: false as const, reason: sendResult.message };
  logEmailFailure("user-invite", params.to, result);
  return result;
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  rawToken: string;
  expiresAt: Date;
}): Promise<{ sent: boolean; reason?: string }> {
  const cfg = readEmailOutboundConfig();
  const appUrl = resolveWebAppPublicUrl();
  const resetUrl = `${appUrl}/redefinir-senha?token=${encodeURIComponent(params.rawToken)}`;

  if (!cfg) return notConfigured("password-reset", params.to);

  const { subject, html } = passwordResetEmailContent({
    name: params.name,
    resetUrl,
    expiresAt: params.expiresAt,
  });

  const sendResult = await sendTransactionalHtmlEmail({
    cfg,
    to: [params.to],
    subject,
    html,
  });

  const result = sendResult.ok
    ? { sent: true as const }
    : { sent: false as const, reason: sendResult.message };
  logEmailFailure("password-reset", params.to, result);
  return result;
}

/** Gera token de convite e envia o e-mail (contas ainda não ativadas). */
export async function sendInviteForExistingUser(
  userId: string,
): Promise<{ sent: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: { select: { name: true, displayName: true } },
    },
  });
  if (!user) return { sent: false, reason: "Usuário não encontrado." };
  if (user.activatedAt) {
    return { sent: false, reason: "Esta conta já está ativada." };
  }
  const { rawToken, expiresAt } = await createActivationToken(
    user.id,
    "USER_INVITE",
  );
  return sendUserInviteEmail({
    to: user.email,
    name: user.name,
    companyName:
      user.organization.displayName || user.organization.name || "PedixPro",
    rawToken,
    expiresAt,
  });
}
