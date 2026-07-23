import { prisma } from "../db.js";
import {
  escapeHtml,
  readEmailOutboundConfig,
  sendTransactionalHtmlEmail,
} from "./email-send.js";
import {
  buildDanfePdfForInvoice,
  loadInvoiceForDanfe,
} from "./nfe-danfe-load.js";

export async function sendFiscalInvoiceEmail(
  organizationId: string,
  invoiceId: string,
  toOverride?: string,
) {
  const cfg = readEmailOutboundConfig();
  if (!cfg) {
    return {
      ok: false as const,
      error:
        "E-mail não configurado. Defina EMAIL_FROM e RESEND_API_KEY (ou SENDGRID_API_KEY).",
    };
  }

  const invoice = await loadInvoiceForDanfe(organizationId, invoiceId);
  if (!invoice || invoice.direction !== "OUTBOUND") {
    return { ok: false as const, error: "Nota não encontrada" };
  }
  if (invoice.status !== "AUTHORIZED" && invoice.status !== "CANCELLED") {
    return {
      ok: false as const,
      error: "Envio disponível apenas para NF-e autorizada ou cancelada",
    };
  }

  const customerEmail =
    toOverride?.trim() || invoice.order?.customer?.email?.trim() || null;
  if (!customerEmail) {
    return {
      ok: false as const,
      error: "Cliente sem e-mail — informe um destinatário",
    };
  }

  const xml = invoice.xmlAuthorized ?? invoice.xmlSigned;
  if (!xml?.trim()) {
    return { ok: false as const, error: "XML da nota não disponível" };
  }

  const danfe = await buildDanfePdfForInvoice(invoice);
  if (!danfe.ok) {
    return { ok: false as const, error: danfe.error };
  }

  const numberLabel =
    invoice.number != null
      ? `${invoice.series ?? ""}/${invoice.number}`
      : invoice.id.slice(0, 8);
  const subject = `NF-e ${numberLabel} — XML e DANFE`;
  const html =
    `<p>Segue em anexo o XML e o DANFE da NF-e <strong>${escapeHtml(numberLabel)}</strong>.</p>` +
    (invoice.accessKey
      ? `<p style="font-family:monospace;font-size:12px">Chave: ${escapeHtml(invoice.accessKey)}</p>`
      : "");

  const sent = await sendTransactionalHtmlEmail({
    cfg,
    to: [customerEmail],
    subject,
    html,
    attachments: [
      {
        filename: `nfe-${invoice.number ?? invoice.id.slice(0, 8)}.xml`,
        content: Buffer.from(xml, "utf8"),
        contentType: "application/xml",
      },
      {
        filename: danfe.filename,
        content: danfe.pdf,
        contentType: "application/pdf",
      },
    ],
  });

  if (!sent.ok) {
    return { ok: false as const, error: sent.message };
  }

  await prisma.fiscalInvoiceEvent.create({
    data: {
      fiscalInvoiceId: invoice.id,
      eventType: "NFeEmail",
      requestPayload: JSON.stringify({ to: customerEmail }),
      responsePayload: "ok",
      success: true,
    },
  });

  return { ok: true as const, to: customerEmail };
}
