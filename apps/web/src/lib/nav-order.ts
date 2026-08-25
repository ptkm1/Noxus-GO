const STORAGE_PREFIX = "pedidos-web-nav-order";

export function navOrderStorageKey(
  organizationId: string,
  userId: string,
): string {
  return `${STORAGE_PREFIX}:${organizationId}:${userId}`;
}

export function loadNavOrder(storageKey: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((k): k is string => typeof k === "string")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveNavOrder(storageKey: string, order: string[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(order));
  } catch {
    /* quota / private mode */
  }
}

export function clearNavOrder(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

/** Aplica ordem salva por `to`; itens novos do config entram no final (ordem default). */
export function applyNavOrder<T extends { to: string }>(
  items: T[],
  savedOrder: string[] | null | undefined,
): T[] {
  if (!savedOrder?.length) return items;
  const byTo = new Map(items.map((item) => [item.to, item]));
  const ordered: T[] = [];
  for (const key of savedOrder) {
    const item = byTo.get(key);
    if (!item) continue;
    ordered.push(item);
    byTo.delete(key);
  }
  for (const item of items) {
    if (byTo.has(item.to)) ordered.push(item);
  }
  return ordered;
}
