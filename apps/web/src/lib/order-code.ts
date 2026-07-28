/** Número do pedido; "—" se ainda não atribuído (sem fallback alfanumérico). */
export function formatOrderCode(order: {
  id: string;
  orderNumber?: number | null;
}): string {
  if (order.orderNumber != null) return String(order.orderNumber);
  return "—";
}

/** Parte segura para nome de arquivo PDF. */
export function orderCodeFilenamePart(order: {
  id: string;
  orderNumber?: number | null;
}): string {
  if (order.orderNumber != null) return String(order.orderNumber);
  return order.id;
}
