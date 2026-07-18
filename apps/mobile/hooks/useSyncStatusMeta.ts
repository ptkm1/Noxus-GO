import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { subscribeOfflineOutbox } from "../lib/offline-outbox-events";
import {
  getLastCacheSyncAt,
  getLastSyncedItemCount,
} from "../lib/offline-read-cache";

export function useSyncStatusMeta(): {
  lastSync: Date | null;
  lastSyncedCount: number | null;
  refresh: () => void;
} {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [lastSyncedCount, setLastSyncedCount] = useState<number | null>(null);

  const refresh = useCallback(() => {
    void getLastCacheSyncAt()
      .then(setLastSync)
      .catch(() => setLastSync(null));
    void getLastSyncedItemCount()
      .then(setLastSyncedCount)
      .catch(() => setLastSyncedCount(null));
  }, []);

  useEffect(() => {
    refresh();
    const unsub = subscribeOfflineOutbox(refresh);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      unsub();
      sub.remove();
    };
  }, [refresh]);

  return { lastSync, lastSyncedCount, refresh };
}
