import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";
import {
  escapeHtml,
  readEmailOutboundConfig,
  sendTransactionalHtmlEmail,
} from "./email-send.js";

type OrderNotifyPayload = {
  id: string;
  totalAmount: unknown;
  seller: { user: { name: string } };
  customer: { name: string } | null;
};

async function notifyAdminsCreditPendingEmail(params: {
  adminEmails: string[];
  order: OrderNotifyPayload;
}): Promise<void> {
  const cfg = readEmailOutboundConfig();
  if (!cfg || !params.adminEmails.length) return;

  const total = decToNum(params.order.totalAmount);
  const cust = params.order.customer?.name ?? "Cliente sem nome";
  const seller = params.order.seller.user.name;
  const subject = "[Pedidos] Pedido aguardando aprovação de crédito";
  const webBase = (process.env.WEB_APP_ORIGIN ?? "").replace(/\/$/, "");
  const detailPath = `/vendas/${params.order.id}`;
  const detailLink =
    webBase.length > 0
      ? `<p><a href="${escapeHtml(webBase + detailPath)}">Abrir pedido no painel</a></p>`
      : `<p><small>ID do pedido (cole no painel): <code>${escapeHtml(params.order.id)}</code></small></p>`;

  const html = `
<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b">
  <p><strong>${escapeHtml(seller)}</strong> · ${escapeHtml(cust)} · <strong>R$ ${escapeHtml(total.toFixed(2))}</strong></p>
  <p>Aprove ou recuse em <strong>Vendas</strong> no painel admin.</p>
  ${detailLink}
</body></html>`.trim();

  const result = await sendTransactionalHtmlEmail({
    cfg,
    to: params.adminEmails,
    subject,
    html,
  });

  if (!result.ok) {
    console.warn("[email] Falha ao notificar admins (crédito):", result.message);
  }
}

/** Dispara alerta in-app para todos os admins da organização e, se configurado, e-mail transacional. */
export async function notifyAdminsCreditPending(params: {
  organizationId: string;
  order: OrderNotifyPayload;
}): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { organizationId: params.organizationId, role: "ADMIN" },
    select: { id: true, email: true },
  });
  if (!admins.length) return;

  const total = decToNum(params.order.totalAmount);
  const cust = params.order.customer?.name ?? "Cliente sem nome";
  const seller = params.order.seller.user.name;
  const title = "Pedido aguardando crédito";
  const body = `${seller} · ${cust} · R$ ${total.toFixed(2)} — aprove em Vendas.\nORDER_ID:${params.order.id}`;

  await prisma.notification.createMany({
    data: admins.map((u) => ({
      userId: u.id,
      title,
      body,
    })),
  });

  const emails = admins.map((a) => a.email);
  try {
    await notifyAdminsCreditPendingEmail({ adminEmails: emails, order: params.order });
  } catch (e) {
    console.warn("[email] Exceção ao enviar notificação de crédito:", e);
  }
}
