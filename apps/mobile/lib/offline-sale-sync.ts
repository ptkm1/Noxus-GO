import { QueryClient } from "@tanstack/react-query";
import { apiUrl, getAccessToken } from "./api";
import {
  claimRowsForSync,
  markOfflineSaleDead,
  markOfflineSaleSent,
  prepareQueuedSalesForImmediateSync,
  releaseStaleSyncingClaims,
  rescheduleOfflineSaleRetry,
  resetOfflineSaleToQueued,
} from "./offline-outbox";
import { notifyOfflineOutboxChanged } from "./offline-outbox-events";
import {
  buildStockAvailabilityMaps,
  checkStockForSale,
  fetchRemoteProductStock,
  reserveStockForSale,
} from "./offline-sale-stock-check";
import { markCacheSynced } from "./offline-read-cache";

function backoffMs(attempt: number): number {
  const base = 4000 * Math.pow(2, Math.min(attempt, 8));
  return Math.min(300_000, base + Math.floor(Math.random() * 1200));
}

function extractApiError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const e = (body as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  if (status === 502 || status === 503 || status === 504) {
    return "Proxy/tunnel indisponível. Confirma se a API e o tunnel (loca.lt/ngrok) estão ativos e tenta de novo.";
  }
  if (status >= 500) return "Erro temporário no servidor";
  return "Erro ao sincronizar";
}

export type SalePostResult =
  | { kind: "success"; orderId: string; status?: string }
  | { kind: "retry"; reason: string }
  | { kind: "dead"; reason: string }
  | { kind: "auth"; reason: string };

export async function postSellerSale(
  payload: Record<string, unknown>,
): Promise<SalePostResult> {
  const token = await getAccessToken();
  if (!token)
    return {
      kind: "auth",
      reason: "Sessão expirada — entre de novo para sincronizar.",
    };

  let res: Response;
  try {
    const url = apiUrl("/seller/sales");
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
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { kind: "retry", reason: msg || "Sem rede" };
  }

  const rawText = await res.text().catch(() => "");
  let body: unknown = {};
  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = {};
    }
  }

  if (res.ok) {
    const id =
      body &&
      typeof body === "object" &&
      typeof (body as { id?: unknown }).id === "string"
        ? (body as { id: string }).id
        : "";
    const status =
      body &&
      typeof body === "object" &&
      typeof (body as { status?: unknown }).status === "string"
        ? (body as { status: string }).status
        : undefined;
    if (!id) return { kind: "retry", reason: "Resposta sem id do pedido" };
    return { kind: "success", orderId: id, status };
  }

  const reason = extractApiError(body, res.status);

  if (res.status === 401) {
    return { kind: "auth", reason };
  }

  if (res.status === 403) {
    return { kind: "dead", reason };
  }

  if (res.status === 400 || res.status === 404 || res.status === 422) {
    return { kind: "dead", reason };
  }

  if (res.status >= 500 || res.status === 408 || res.status === 429) {
    return { kind: "retry", reason: `${res.status}: ${reason}` };
  }

  return { kind: "retry", reason: `${res.status}: ${reason}` };
}

const MAX_TRANSIENT_ATTEMPTS = 14;

let syncRunning = false;

export type FlushOfflineSaleResult = {
  processed: number;
  sent: number;
  stockBlocked: number;
  /** Mensagens de estoque (com nome do produto) da pré-checagem. */
  stockBlockedReasons: string[];
};

export async function flushOfflineSaleOutbox(
  qc?: QueryClient,
  opts?: { forceImmediate?: boolean },
): Promise<FlushOfflineSaleResult> {
  const empty: FlushOfflineSaleResult = {
    processed: 0,
    sent: 0,
    stockBlocked: 0,
    stockBlockedReasons: [],
  };
  if (syncRunning) return empty;
  const token = await getAccessToken();
  if (!token) return empty;
  syncRunning = true;
  let processed = 0;
  let sent = 0;
  let stockBlocked = 0;
  const stockBlockedReasons: string[] = [];
  try {
    try {
      await releaseStaleSyncingClaims();
      if (opts?.forceImmediate) {
        await prepareQueuedSalesForImmediateSync();
      }
    } catch {
      return empty;
    }
    const now = Date.now();
    const rows = await claimRowsForSync(now, 10);

    let stockMaps: ReturnType<typeof buildStockAvailabilityMaps> | null = null;
    if (opts?.forceImmediate && rows.length > 0) {
      const productIds = rows.flatMap((r) =>
        r.payload.items.map((i) => i.productId),
      );
      const remote = await fetchRemoteProductStock(productIds);
      if (remote) {
        stockMaps = buildStockAvailabilityMaps(remote);
      }
    }

    for (const row of rows) {
      if (stockMaps) {
        const stockError = checkStockForSale(
          row,
          stockMaps.available,
          stockMaps.blockedIds,
        );
        if (stockError) {
          await resetOfflineSaleToQueued(row.localId, stockError);
          stockBlocked += 1;
          stockBlockedReasons.push(stockError);
          processed += 1;
          continue;
        }
      }

      const payload = {
        customerId: row.payload.customerId,
        paymentConditionId: row.payload.paymentConditionId,
        operation: row.payload.operation ?? "SALE",
        status: row.payload.status,
        notes: row.payload.notes,
        items: row.payload.items,
        clientMutationId: row.payload.clientMutationId,
      };
      const result = await postSellerSale(payload);
      if (result.kind === "success") {
        if (stockMaps) {
          reserveStockForSale(
            row,
            stockMaps.available,
            stockMaps.blockedIds,
          );
        }
        await markOfflineSaleSent(row.localId);
        processed += 1;
        sent += 1;
        continue;
      }
      if (result.kind === "dead") {
        await markOfflineSaleDead(row.localId, result.reason);
        processed += 1;
        continue;
      }
      if (result.kind === "auth") {
        await resetOfflineSaleToQueued(row.localId, result.reason);
        break;
      }
      const nextAttempts = row.attempts + 1;
      if (nextAttempts >= MAX_TRANSIENT_ATTEMPTS) {
        await markOfflineSaleDead(
          row.localId,
          `Sem rede após ${nextAttempts} tentativas: ${result.reason}`,
        );
      } else {
        await rescheduleOfflineSaleRetry(
          row.localId,
          nextAttempts,
          Date.now() + backoffMs(nextAttempts),
          result.reason,
        );
      }
      processed += 1;
    }
    if (processed > 0) {
      await markCacheSynced(processed).catch(() => undefined);
      notifyOfflineOutboxChanged();
      if (qc) {
        void qc.invalidateQueries({ queryKey: ["seller", "sales"] });
        void qc.invalidateQueries({
          queryKey: ["seller", "commission-dashboard"],
        });
        void qc.invalidateQueries({ queryKey: ["seller", "customer-credit"] });
        if (sent > 0) {
          void qc.invalidateQueries({ queryKey: ["seller", "products"] });
        }
      }
    }
    return { processed, sent, stockBlocked, stockBlockedReasons };
  } finally {
    syncRunning = false;
  }
}
