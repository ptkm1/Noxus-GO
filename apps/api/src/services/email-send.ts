/** Envio transacional opcional (Resend recomendado; SendGrid como alternativa). */

export type EmailOutboundConfig = {
  provider: "resend" | "sendgrid";
  apiKey: string;
  /** Ex.: `PedixPro <noreply@seudominio.com>` ou só o e-mail. */
  fromRaw: string;
};

function trim(s: string | undefined): string {
  return (s ?? "").trim();
}

/** Nome + e-mail ou só e-mail. */
export function parseFromHeader(raw: string): { email: string; name?: string } {
  const t = raw.trim();
  const m = t.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) {
    const name = m[1].replace(/^["']|["']$/g, "").trim();
    const email = m[2].trim();
    return name ? { email, name } : { email };
  }
  return { email: t };
}

/** Resolve provedor e credenciais; devolve null se e-mail estiver desligado. */
export function readEmailOutboundConfig(): EmailOutboundConfig | null {
  const fromRaw = trim(process.env.EMAIL_FROM);
  const explicit = trim(process.env.EMAIL_PROVIDER).toLowerCase();

  const resendKey = trim(process.env.RESEND_API_KEY);
  const sendgridKey = trim(process.env.SENDGRID_API_KEY);

  let provider: "resend" | "sendgrid" | null = null;
  let apiKey = "";

  if (explicit === "sendgrid") {
    provider = "sendgrid";
    apiKey = sendgridKey;
  } else if (explicit === "resend") {
    provider = "resend";
    apiKey = resendKey;
  } else if (resendKey) {
    provider = "resend";
    apiKey = resendKey;
  } else if (sendgridKey) {
    provider = "sendgrid";
    apiKey = sendgridKey;
  }

  if (!provider || !apiKey || !fromRaw) return null;

  return { provider, apiKey, fromRaw };
}

/** Mensagem acionável a partir do erro cru do provedor. */
export function explainEmailSendFailure(raw: string): string {
  const jsonStart = raw.indexOf("{");
  let t = raw.trim();
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as { message?: string };
      if (parsed.message?.trim()) t = parsed.message.trim();
    } catch {
      /* usa o texto cru */
    }
  }
  if (t === "EMAIL_NOT_CONFIGURED" || t === "unknown") {
    return "E-mail não configurado. Defina RESEND_API_KEY e EMAIL_FROM no .env da API.";
  }
  if (/only send testing emails to your own email/i.test(t)) {
    const allowed = t.match(/\(([^)]+@[^)]+)\)/)?.[1];
    return allowed
      ? `O Resend está em modo de teste e só entrega para ${allowed}. Verifique um domínio em resend.com/domains e altere EMAIL_FROM para um e-mail desse domínio.`
      : "O Resend está em modo de teste. Verifique um domínio em resend.com/domains e altere EMAIL_FROM para um e-mail desse domínio.";
  }
  if (/Invalid `to` field/i.test(t)) {
    return "Destinatário recusado pelo Resend. Use um e-mail real (em modo de teste, só o e-mail da conta Resend).";
  }
  return t;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

async function sendViaResend(params: {
  apiKey: string;
  fromRaw: string;
  to: string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.fromRaw,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.attachments?.length
        ? {
            attachments: params.attachments.map((a) => ({
              filename: a.filename,
              content: a.content.toString("base64"),
              content_type: a.contentType,
            })),
          }
        : {}),
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return {
      ok: false,
      message: explainEmailSendFailure(
        `Resend HTTP ${res.status}: ${errBody.slice(0, 400)}`,
      ),
    };
  }
  return { ok: true };
}

async function sendViaSendGrid(params: {
  apiKey: string;
  fromRaw: string;
  to: string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = parseFromHeader(params.fromRaw);
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: params.to.map((email) => ({ email })) }],
      from: parsed.name
        ? { email: parsed.email, name: parsed.name }
        : { email: parsed.email },
      subject: params.subject,
      content: [{ type: "text/html", value: params.html }],
      ...(params.attachments?.length
        ? {
            attachments: params.attachments.map((a) => ({
              content: a.content.toString("base64"),
              filename: a.filename,
              type: a.contentType,
              disposition: "attachment",
            })),
          }
        : {}),
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return {
      ok: false,
      message: `SendGrid HTTP ${res.status}: ${errBody.slice(0, 400)}`,
    };
  }
  return { ok: true };
}

/** Um envio para vários destinatários (lista deduplicada). */
export async function sendTransactionalHtmlEmail(params: {
  cfg: EmailOutboundConfig;
  to: string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const uniq = [...new Set(params.to.map((e) => e.trim()).filter(Boolean))];
  if (!uniq.length) return { ok: false, message: "Sem destinatários" };

  if (params.cfg.provider === "resend") {
    return sendViaResend({
      apiKey: params.cfg.apiKey,
      fromRaw: params.cfg.fromRaw,
      to: uniq,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    });
  }
  return sendViaSendGrid({
    apiKey: params.cfg.apiKey,
    fromRaw: params.cfg.fromRaw,
    to: uniq,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments,
  });
}
