import { apiUrl, getAccessToken } from "./api";
import type { OfflineQueueRow } from "./offline-sale-types";

export type RemoteProductStock = {
  productId: string;
  name: string;
  stockQty: number;
  blockSaleWhenOutOfStock: boolean;
};

export async function fetchRemoteProductStock(
  productIds: string[],
): Promise<RemoteProductStock[] | null> {
  const unique = [...new Set(productIds.filter(Boolean))];
  if (unique.length === 0) return [];

  const token = await getAccessToken();
  if (!token) return null;

  let res: Response;
  try {
    const url = apiUrl("/seller/products/stock-check");
    const h = new Headers({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    });
    if (/ngrok(-free)?\.app/i.test(url)) {
      h.set("ngrok-skip-browser-warning", "true");
    }
    res = await fetch(url, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ productIds: unique }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as {
    products?: unknown;
  } | null;
  if (!body || !Array.isArray(body.products)) return null;

  const out: RemoteProductStock[] = [];
  for (const raw of body.products) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    if (typeof p.productId !== "string") continue;
    out.push({
      productId: p.productId,
      name: typeof p.name === "string" ? p.name : p.productId,
      stockQty: typeof p.stockQty === "number" ? p.stockQty : 0,
      blockSaleWhenOutOfStock: p.blockSaleWhenOutOfStock === true,
    });
  }
  return out;
}

function neededBlockedQty(
  row: OfflineQueueRow,
  blockedIds: Set<string>,
): Map<string, number> {
  const needByProduct = new Map<string, number>();
  for (const item of row.payload.items) {
    if (!item.productId || item.quantity <= 0) continue;
    if (!blockedIds.has(item.productId)) continue;
    needByProduct.set(
      item.productId,
      (needByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }
  return needByProduct;
}

/** Retorna erro se a venda não couber no estoque simulado (não altera o mapa). */
export function checkStockForSale(
  row: OfflineQueueRow,
  available: Map<string, { name: string; qty: number }>,
  blockedIds: Set<string>,
): string | null {
  const needByProduct = neededBlockedQty(row, blockedIds);
  for (const [productId, need] of needByProduct) {
    const stock = available.get(productId);
    if (!stock || stock.qty < need) {
      const name = stock?.name ?? productId;
      const disponivel = stock?.qty ?? 0;
      return `Estoque insuficiente para ${name} (disponível: ${disponivel}, pedido: ${need})`;
    }
  }
  return null;
}

/** Deduz do mapa após envio bem-sucedido (reserva na ordem da fila). */
export function reserveStockForSale(
  row: OfflineQueueRow,
  available: Map<string, { name: string; qty: number }>,
  blockedIds: Set<string>,
): void {
  const needByProduct = neededBlockedQty(row, blockedIds);
  for (const [productId, need] of needByProduct) {
    const stock = available.get(productId);
    if (!stock) continue;
    stock.qty -= need;
  }
}

export function buildStockAvailabilityMaps(products: RemoteProductStock[]): {
  available: Map<string, { name: string; qty: number }>;
  blockedIds: Set<string>;
} {
  const available = new Map<string, { name: string; qty: number }>();
  const blockedIds = new Set<string>();
  for (const p of products) {
    available.set(p.productId, { name: p.name, qty: p.stockQty });
    if (p.blockSaleWhenOutOfStock) blockedIds.add(p.productId);
  }
  return { available, blockedIds };
}
