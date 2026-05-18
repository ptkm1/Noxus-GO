import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

let dbSingleton: SQLiteDatabase | null = null;

export async function getOfflineSQLite(): Promise<SQLiteDatabase | null> {
  if (dbSingleton) return dbSingleton;
  try {
    const db = await openDatabaseAsync("pedidos_offline.db");
    await db.execAsync(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS offline_sale_outbox (
  local_id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at_ms INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  server_order_id TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offbox_state_retry ON offline_sale_outbox(state, next_retry_at_ms);
`);
    dbSingleton = db;
    return db;
  } catch {
    return null;
  }
}
