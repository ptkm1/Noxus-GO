import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { flushOfflineSaleOutbox } from "../lib/offline-sale-sync";
import { useOfflineOutboxCounts } from "../lib/useOfflineOutboxCounts";
import { useOrderSyncMode } from "./useOrderSyncMode";

function syncSummaryMessage(sent: number, stockBlocked: number): string {
  const parts: string[] = [];
  if (sent > 0) {
    parts.push(`${sent} enviado${sent === 1 ? "" : "s"}`);
  }
  if (stockBlocked > 0) {
    parts.push(
      `${stockBlocked} não sincronizado${stockBlocked === 1 ? "" : "s"} por falta de estoque`,
    );
  }
  if (parts.length === 0) {
    return "Nenhum pedido foi enviado nesta tentativa.";
  }
  return parts.join(", ") + ".";
}

/** Sync manual com pré-checagem de estoque (forceImmediate). */
export function useManualSaleSync(opts?: {
  onAfterSync?: () => void | Promise<void>;
}) {
  const qc = useQueryClient();
  const { pending, dead, refresh } = useOfflineOutboxCounts();
  const { orderSyncMode } = useOrderSyncMode();
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const onAfterSyncRef = useRef(opts?.onAfterSync);
  onAfterSyncRef.current = opts?.onAfterSync;

  const queueCount = pending + dead;
  const showSyncButton = orderSyncMode === "MANUAL" || queueCount > 0;

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await flushOfflineSaleOutbox(qc, { forceImmediate: true });
      refresh();
      await onAfterSyncRef.current?.();
      if (result.processed > 0 || result.stockBlocked > 0) {
        Alert.alert(
          "Sincronização",
          syncSummaryMessage(result.sent, result.stockBlocked),
        );
      } else {
        Alert.alert("Sincronização", "Nada pendente para enviar agora.");
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [qc, refresh]);

  return {
    syncNow,
    syncing,
    showSyncButton,
    queueCount,
    pending,
    dead,
    orderSyncMode,
    refresh,
  };
}
