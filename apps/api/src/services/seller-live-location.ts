/** Considera vendedor "online" se enviou GPS nos últimos N minutos. */
export const SELLER_ONLINE_MAX_AGE_MS = 5 * 60 * 1000;

export function isSellerLocationOnline(recordedAt: Date, now = new Date()): boolean {
  return now.getTime() - recordedAt.getTime() <= SELLER_ONLINE_MAX_AGE_MS;
}
