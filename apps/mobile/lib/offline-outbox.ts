import { runOfflineDb } from "./offline-db";
import { notifyOfflineOutboxChanged } from "./offline-outbox-events";
import type {
  OfflineQueueRow,
  OfflineQueueRowState,
  OfflineSaleQueuePayload,
} from "./offline-sale-types";

function rowFromDb(r: {
  local_id: string;
  payload: string;
  state: string;
  attempts: number;
  next_retry_at_ms: number;
  last_error: string | null;
  server_order_id: string | null;
  created_at_ms: number;
  updated_at_ms: number;
}): OfflineQueueRow {
  let payload: OfflineSaleQueuePayload;
  try {
    payload = JSON.parse(r.payload) as OfflineSaleQueuePayload;
  } catch {
    payload = {
      clientMutationId: r.local_id,
      status: "CONFIRMED",
      items: [],
    };
  }
  return {
    localId: r.local_id,
    payload,
    state: r.state as OfflineQueueRowState,
    attempts: r.attempts,
    nextRetryAtMs: r.next_retry_at_ms,
    lastError: r.last_error,
    serverOrderId: r.server_order_id,
    createdAtMs: r.created_at_ms,
    updatedAtMs: r.updated_at_ms,
  };
}

export async function enqueueOfflineSale(
  payload: OfflineSaleQueuePayload,
): Promise<boolean> {
  const ok = await runOfflineDb(async (db) => {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO offline_sale_outbox (local_id, payload, state, attempts, next_retry_at_ms, last_error, server_order_id, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'queued', 0, 0, NULL, NULL, ?, ?)`,
      [payload.clientMutationId, JSON.stringify(payload), now, now],
    );
    return true;
  }, false);
  if (ok) notifyOfflineOutboxChanged();
  return ok;
}

export async function countPendingOfflineSales(): Promise<number> {
  return runOfflineDb(async (db) => {
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM offline_sale_outbox WHERE state IN ('queued', 'syncing')`,
    );
    return row?.c ?? 0;
  }, 0);
}

export async function countDeadOfflineSales(): Promise<number> {
  return runOfflineDb(async (db) => {
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM offline_sale_outbox WHERE state = 'dead'`,
    );
    return row?.c ?? 0;
  }, 0);
}

export async function listOfflineSaleRows(
  limit = 50,
): Promise<OfflineQueueRow[]> {
  return runOfflineDb(async (db) => {
    const rows = await db.getAllAsync<{
      local_id: string;
      payload: string;
      state: string;
      attempts: number;
      next_retry_at_ms: number;
      last_error: string | null;
      server_order_id: string | null;
      created_at_ms: number;
      updated_at_ms: number;
    }>(
      `SELECT * FROM offline_sale_outbox WHERE state != 'sent' ORDER BY created_at_ms ASC LIMIT ?`,
      [limit],
    );
    return rows.map(rowFromDb);
  }, []);
}

export async function deleteOfflineSaleRow(localId: string): Promise<void> {
  await runOfflineDb(async (db) => {
    await db.runAsync(`DELETE FROM offline_sale_outbox WHERE local_id = ?`, [
      localId,
    ]);
    return true;
  }, false);
  notifyOfflineOutboxChanged();
}

export async function claimRowsForSync(
  nowMs: number,
  batch = 8,
): Promise<OfflineQueueRow[]> {
  return runOfflineDb(async (db) => {
    await db.execAsync("BEGIN IMMEDIATE;");
    try {
      const candidates = await db.getAllAsync<{ local_id: string }>(
        `SELECT local_id FROM offline_sale_outbox
         WHERE state = 'queued' AND next_retry_at_ms <= ?
         ORDER BY created_at_ms ASC
         LIMIT ?`,
        [nowMs, batch],
      );
      const ids = candidates.map((c) => c.local_id);
      if (!ids.length) {
        await db.execAsync("COMMIT;");
        return [];
      }
      const placeholders = ids.map(() => "?").join(",");
      await db.runAsync(
        `UPDATE offline_sale_outbox SET state = 'syncing', updated_at_ms = ? WHERE local_id IN (${placeholders})`,
        [nowMs, ...ids],
      );
      const full = await db.getAllAsync<{
        local_id: string;
        payload: string;
        state: string;
        attempts: number;
        next_retry_at_ms: number;
        last_error: string | null;
        server_order_id: string | null;
        created_at_ms: number;
        updated_at_ms: number;
      }>(
        `SELECT * FROM offline_sale_outbox WHERE local_id IN (${placeholders})`,
        [...ids],
      );
      await db.execAsync("COMMIT;");
      notifyOfflineOutboxChanged();
      return full.map(rowFromDb);
    } catch {
      try {
        await db.execAsync("ROLLBACK;");
      } catch {
        /* ignore */
      }
      return [];
    }
  }, []);
}

export async function releaseStaleSyncingClaims(
  timeoutMs = 120_000,
): Promise<void> {
  await runOfflineDb(async (db) => {
    const cutoff = Date.now() - timeoutMs;
    await db.runAsync(
      `UPDATE offline_sale_outbox SET state = 'queued', updated_at_ms = ?
       WHERE state = 'syncing' AND updated_at_ms < ?`,
      [Date.now(), cutoff],
    );
    return true;
  }, false);
}

export async function markOfflineSaleSent(localId: string): Promise<void> {
  await runOfflineDb(async (db) => {
    await db.runAsync(`DELETE FROM offline_sale_outbox WHERE local_id = ?`, [
      localId,
    ]);
    return true;
  }, false);
  notifyOfflineOutboxChanged();
}

export async function rescheduleOfflineSaleRetry(
  localId: string,
  attempts: number,
  nextRetryAtMs: number,
  lastError: string,
): Promise<void> {
  await runOfflineDb(async (db) => {
    await db.runAsync(
      `UPDATE offline_sale_outbox SET state = 'queued', attempts = ?, next_retry_at_ms = ?, last_error = ?, updated_at_ms = ?
       WHERE local_id = ?`,
      [attempts, nextRetryAtMs, lastError, Date.now(), localId],
    );
    return true;
  }, false);
  notifyOfflineOutboxChanged();
}

export async function markOfflineSaleDead(
  localId: string,
  lastError: string,
): Promise<void> {
  await runOfflineDb(async (db) => {
    await db.runAsync(
      `UPDATE offline_sale_outbox SET state = 'dead', last_error = ?, updated_at_ms = ?
       WHERE local_id = ?`,
      [lastError, Date.now(), localId],
    );
    return true;
  }, false);
  notifyOfflineOutboxChanged();
}

export async function resetOfflineSaleToQueued(
  localId: string,
  lastError: string,
): Promise<void> {
  await runOfflineDb(async (db) => {
    await db.runAsync(
      `UPDATE offline_sale_outbox SET state = 'queued', next_retry_at_ms = 0, last_error = ?, updated_at_ms = ?
       WHERE local_id = ?`,
      [lastError, Date.now(), localId],
    );
    return true;
  }, false);
  notifyOfflineOutboxChanged();
}

export async function reviveOfflineSaleRow(localId: string): Promise<void> {
  await runOfflineDb(async (db) => {
    await db.runAsync(
      `UPDATE offline_sale_outbox SET state = 'queued', attempts = 0, next_retry_at_ms = 0, last_error = NULL, updated_at_ms = ?
       WHERE local_id = ?`,
      [Date.now(), localId],
    );
    return true;
  }, false);
  notifyOfflineOutboxChanged();
}

/** Para "Sincronizar agora": põe todos os queued prontos (ignora backoff). */
export async function prepareQueuedSalesForImmediateSync(): Promise<void> {
  await runOfflineDb(async (db) => {
    await db.runAsync(
      `UPDATE offline_sale_outbox SET next_retry_at_ms = 0, updated_at_ms = ?
       WHERE state = 'queued'`,
      [Date.now()],
    );
    return true;
  }, false);
}
