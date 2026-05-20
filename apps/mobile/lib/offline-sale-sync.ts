import { QueryClient } from "@tanstack/react-query";
import { apiUrl, getAccessToken } from "./api";
import {
  claimRowsForSync,
  markOfflineSaleDead,
  markOfflineSaleSent,
  releaseStaleSyncingClaims,
  rescheduleOfflineSaleRetry,
  resetOfflineSaleToQueued,
} from "./offline-outbox";

function backoffMs(attempt: number): number {
  const base = 4000 * Math.pow(2, Math.min(attempt, 8));
  return Math.min(300_000, base + Math.floor(Math.random() * 1200));
}

function extractApiError(body: unknown): string {
  if (body && typeof body === "object") {
    const e = (body as { error?: unknown }).error;
    if (typeof e === "string") return e;
  }
  return "Erro ao sincronizar";
}

export type SalePostResult =
  | { kind: "success"; orderId: string; status?: string }
  | { kind: "retry"; reason: string }
  | { kind: "dead"; reason: string }
  | { kind: "auth"; reason: string };

export async function postSellerSale(payload: Record<string, unknown>): Promise<SalePostResult> {
  const token = await getAccessToken();
  if (!token) return { kind: "auth", reason: "Sessão expirada — entre de novo para sincronizar." };

  let res: Response;
  try {
    const url = apiUrl("/seller/sales");
    const h = new Headers({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });
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

  const body = await res.json().catch(() => ({}));

  if (res.ok) {
    const id =
      body && typeof body === "object" && typeof (body as { id?: unknown }).id === "string"
        ? (body as { id: string }).id
        : "";
    const status =
      body && typeof body === "object" && typeof (body as { status?: unknown }).status === "string"
        ? (body as { status: string }).status
        : undefined;
    if (!id) return { kind: "retry", reason: "Resposta sem id do pedido" };
    return { kind: "success", orderId: id, status };
  }

  if (res.status === 401) {
    return { kind: "auth", reason: extractApiError(body) };
  }

  if (res.status === 403) {
    return { kind: "dead", reason: extractApiError(body) };
  }

  if (res.status === 400 || res.status === 404 || res.status === 422) {
    return { kind: "dead", reason: extractApiError(body) };
  }

  if (res.status >= 500 || res.status === 408 || res.status === 429) {
    return { kind: "retry", reason: `${res.status}: ${extractApiError(body)}` };
  }

  return { kind: "retry", reason: `${res.status}: ${extractApiError(body)}` };
}

const MAX_TRANSIENT_ATTEMPTS = 14;

let syncRunning = false;

export async function flushOfflineSaleOutbox(qc?: QueryClient): Promise<{ processed: number }> {
  if (syncRunning) return { processed: 0 };
  const token = await getAccessToken();
  if (!token) return { processed: 0 };
  syncRunning = true;
  let processed = 0;
  try {
    try {
      await releaseStaleSyncingClaims();
    } catch {
      return { processed: 0 };
    }
    const now = Date.now();
    const rows = await claimRowsForSync(now, 10);
    for (const row of rows) {
      const payload = {
        customerId: row.payload.customerId,
        status: row.payload.status,
        notes: row.payload.notes,
        items: row.payload.items,
        clientMutationId: row.payload.clientMutationId,
      };
      const result = await postSellerSale(payload);
      if (result.kind === "success") {
        await markOfflineSaleSent(row.localId);
        processed += 1;
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
        await markOfflineSaleDead(row.localId, `Sem rede após ${nextAttempts} tentativas: ${result.reason}`);
      } else {
        await rescheduleOfflineSaleRetry(row.localId, nextAttempts, Date.now() + backoffMs(nextAttempts), result.reason);
      }
      processed += 1;
    }
    if (qc && processed > 0) {
      void qc.invalidateQueries({ queryKey: ["seller", "sales"] });
      void qc.invalidateQueries({ queryKey: ["seller", "commission-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["seller", "customer-credit"] });
    }
    return { processed };
  } finally {
    syncRunning = false;
  }
}
