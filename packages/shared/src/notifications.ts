/** Tipos de notificação in-app / push. */
export const NOTIFICATION_TYPES = [
  "GENERIC",
  "SALE_CONFIRMED",
  "CREDIT_PENDING",
  "GOAL_UPDATED",
  "CREDIT_RESOLVED",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationData = {
  orderId?: string;
  sellerId?: string;
  goalId?: string;
  href?: string;
  [key: string]: unknown;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  data: NotificationData | null;
  read: boolean;
  createdAt: string;
};

export function notificationHref(
  n: Pick<AppNotification, "type" | "data" | "body">,
): string | null {
  if (n.data && typeof n.data.href === "string" && n.data.href.length > 0) {
    return n.data.href;
  }
  if (n.data && typeof n.data.orderId === "string" && n.data.orderId.length > 0) {
    return `/pedidos/${n.data.orderId}`;
  }
  const m = n.body.match(/ORDER_ID:([^\s\n]+)/);
  return m?.[1] ? `/pedidos/${m[1]}` : null;
}

export function notificationBodyDisplay(body: string): string {
  return body.replace(/\n?ORDER_ID:[^\s\n]+$/, "").trim();
}
