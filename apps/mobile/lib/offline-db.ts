import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

let dbInit: Promise<SQLiteDatabase | null> | null = null;
/** Serializa operações — evita prepareAsync em paralelo (NPE no Android). */
let opChain: Promise<unknown> = Promise.resolve();

function isSqliteNativeError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("NativeDatabase.prepareAsync") ||
    msg.includes("NullPointerException") ||
    msg.includes("prepareAsync")
  );
}

async function openOfflineDb(): Promise<SQLiteDatabase | null> {
  if (!dbInit) {
    dbInit = (async () => {
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
CREATE TABLE IF NOT EXISTS cache_products (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cache_customers (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cache_sales (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cache_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
`);
        return db;
      } catch {
        return null;
      }
    })();
  }
  const db = await dbInit;
  if (!db) {
    dbInit = null;
  }
  return db;
}

function resetOfflineDb(): void {
  dbInit = null;
}

/**
 * Executa uma operação SQLite de cada vez. Em falha nativa, reinicia a conexão na próxima chamada.
 */
export function runOfflineDb<T>(
  fn: (db: SQLiteDatabase) => Promise<T>,
  fallback: T,
): Promise<T> {
  const task = async (): Promise<T> => {
    const db = await openOfflineDb();
    if (!db) return fallback;
    try {
      return await fn(db);
    } catch (e) {
      if (isSqliteNativeError(e)) {
        resetOfflineDb();
      }
      return fallback;
    }
  };

  const result = opChain.then(task, task) as Promise<T>;
  opChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** @deprecated Preferir runOfflineDb — mantido para compatibilidade interna. */
export async function getOfflineSQLite(): Promise<SQLiteDatabase | null> {
  return openOfflineDb();
}
