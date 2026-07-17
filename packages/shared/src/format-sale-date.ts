/** Data relativa para listagens de venda: "Hoje, 10:24", "Ontem" ou data curta em pt-BR. */
export function formatRelativeSaleDate(
  iso: string,
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfDate = new Date(date);
  startOfDate.setHours(0, 0, 0, 0);

  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (startOfDate.getTime() === startOfToday.getTime()) {
    return `Hoje, ${time}`;
  }
  if (startOfDate.getTime() === startOfYesterday.getTime()) {
    return "Ontem";
  }

  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

export function formatSaleItemCount(count: number): string {
  return count === 1 ? "1 item" : `${count} itens`;
}
