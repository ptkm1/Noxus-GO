import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  deleteOfflineSaleRow,
  listOfflineSaleRows,
  reviveOfflineSaleRow,
} from "../../lib/offline-outbox";
import { flushOfflineSaleOutbox } from "../../lib/offline-sale-sync";
import type { OfflineQueueRow } from "../../lib/offline-sale-types";
import { useOfflineOutboxCounts } from "../../lib/useOfflineOutboxCounts";

export function useOfflineQueueScreen() {
  const qc = useQueryClient();
  const router = useRouter();
  const { refresh } = useOfflineOutboxCounts();
  const [rows, setRows] = useState<OfflineQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listOfflineSaleRows(100));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await flushOfflineSaleOutbox(qc);
      refresh();
      await load();
    } finally {
      setSyncing(false);
    }
  }, [qc, load, refresh]);

  const retryRow = useCallback(
    (localId: string) => {
      Alert.alert(
        "Repetir envio?",
        "O servidor vai recalcular preços e crédito.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Enviar",
            onPress: () =>
              void (async () => {
                setBusyId(localId);
                try {
                  await reviveOfflineSaleRow(localId);
                  refresh();
                  await load();
                  await syncNow();
                } finally {
                  setBusyId(null);
                }
              })(),
          },
        ],
      );
    },
    [load, refresh, syncNow],
  );

  const discardRow = useCallback(
    (localId: string) => {
      Alert.alert("Remover pedido da fila?", "Perde este registo offline.", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () =>
            void (async () => {
              setBusyId(localId);
              try {
                await deleteOfflineSaleRow(localId);
                refresh();
                await load();
              } finally {
                setBusyId(null);
              }
            })(),
        },
      ]);
    },
    [load, refresh],
  );

  return {
    rows,
    loading,
    syncing,
    busyId,
    syncNow,
    retryRow,
    discardRow,
    goBack: () => router.back(),
  };
}
