import { useCallback, useEffect, useState } from "react";
import { countDeadOfflineSales, countPendingOfflineSales } from "./offline-outbox";
import { subscribeOfflineOutbox } from "./offline-outbox-events";

export function useOfflineOutboxCounts(): { pending: number; dead: number; refresh: () => void } {
  const [pending, setPending] = useState(0);
  const [dead, setDead] = useState(0);

  const refresh = useCallback(() => {
    void countPendingOfflineSales()
      .then(setPending)
      .catch(() => setPending(0));
    void countDeadOfflineSales()
      .then(setDead)
      .catch(() => setDead(0));
  }, []);

  useEffect(() => {
    refresh();
    return subscribeOfflineOutbox(refresh);
  }, [refresh]);

  return { pending, dead, refresh };
}
