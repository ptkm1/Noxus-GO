/** Código legível do pedido (orderNumber ou prefixo do id). */
export function formatOrderCode(order: {
  id: string;
  orderNumber?: number | null;
}): string {
  if (order.orderNumber != null) return String(order.orderNumber);
  return `#${order.id.slice(0, 8)}`;
}
