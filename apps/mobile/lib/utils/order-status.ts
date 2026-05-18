export function orderStatusBadgeLabel(status: string): string {
  if (status === "PENDING_CREDIT_APPROVAL") return "Crédito";
  if (status === "CONFIRMED") return "OK";
  return status;
}

export function orderStatusDetailLabel(status: string): string {
  if (status === "PENDING_CREDIT_APPROVAL") return "Aguardando crédito";
  if (status === "CONFIRMED") return "Confirmada";
  return status;
}
