import {
  readEmailOutboundConfig,
  sendTransactionalHtmlEmail,
} from "../email-send.js";
import {
  ownerActivationEmailContent,
  passwordResetEmailContent,
  resolveWebAppPublicUrl,
  userInviteEmailContent,
} from "../email-templates.js";

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

  if (!cfg) {
    const result = { sent: false as const, reason: "EMAIL_NOT_CONFIGURED" };
    logEmailFailure("owner-activation", params.to, result);
    return result;
  }

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

  if (!cfg) {
    const result = { sent: false as const, reason: "EMAIL_NOT_CONFIGURED" };
    logEmailFailure("user-invite", params.to, result);
    return result;
  }

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

  if (!cfg) {
    const result = { sent: false as const, reason: "EMAIL_NOT_CONFIGURED" };
    logEmailFailure("password-reset", params.to, result);
    return result;
  }

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
