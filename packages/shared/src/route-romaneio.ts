/** Agrupamento financeiro do romaneio de rota (UI + PDF). */

export type RomaneioPaymentCondition = {
  id: string;
  name: string;
  days: number;
  sortOrder: number;
};

export type RomaneioOrderTotal = {
  id: string;
  totalAmount: number;
  paymentCondition: RomaneioPaymentCondition | null;
};

export type RomaneioPaymentGroup = {
  key: string;
  label: string;
  days: number;
  sortOrder: number;
  count: number;
  total: number;
};

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function paymentConditionLabel(
  pc: RomaneioPaymentCondition | null | undefined,
): string {
  if (!pc) return "Sem condição";
  const name = pc.name.trim();
  if (name) return name;
  if (pc.days === 0) return "À vista";
  return `${pc.days} dias`;
}

export function uniqueIdsPreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function groupOrdersByPaymentCondition(
  orders: RomaneioOrderTotal[],
): RomaneioPaymentGroup[] {
  const map = new Map<string, RomaneioPaymentGroup>();
  for (const o of orders) {
    const key = o.paymentCondition?.id ?? "__none__";
    const amount = roundMoney(o.totalAmount);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.total = roundMoney(existing.total + amount);
    } else {
      map.set(key, {
        key,
        label: paymentConditionLabel(o.paymentCondition),
        days: o.paymentCondition?.days ?? -1,
        sortOrder: o.paymentCondition?.sortOrder ?? 9999,
        count: 1,
        total: amount,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.days !== b.days) return a.days - b.days;
    return a.label.localeCompare(b.label, "pt-BR");
  });
}

export function sumOrderTotals(orders: { totalAmount: number }[]): number {
  return roundMoney(orders.reduce((s, o) => s + Number(o.totalAmount), 0));
}

/** Número de conferência gerado na emissão (America/Sao_Paulo). */
export function formatRomaneioNumber(generatedAt: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(generatedAt);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `ROM-${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}${get("second")}`;
}
