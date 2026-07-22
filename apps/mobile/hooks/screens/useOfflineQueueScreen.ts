import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  deleteOfflineSaleRow,
  listOfflineSaleRows,
  reviveOfflineSaleRow,
} from "../../lib/offline-outbox";
import type { OfflineQueueRow } from "../../lib/offline-sale-types";
import { useManualSaleSync } from "../useManualSaleSync";
import { useOrderSyncMode } from "../useOrderSyncMode";

export function useOfflineQueueScreen() {
  const router = useRouter();
  const { settings } = useOrderSyncMode();
  const canEditQueued = settings?.sellerCanEditQueuedSales === true;
  const [rows, setRows] = useState<OfflineQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listOfflineSaleRows(100));
    } finally {
      setLoading(false);
    }
  }, []);

  const { syncNow, syncing, refresh } = useManualSaleSync({
    onAfterSync: load,
  });

  useEffect(() => {
    void load();
  }, [load]);

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

  const editRow = useCallback(
    (localId: string) => {
      if (!canEditQueued) return;
      const row = rows.find((r) => r.localId === localId);
      // Só pedidos ainda locais (fila / erro de validação) — nunca vendas já sincronizadas.
      if (!row || (row.state !== "queued" && row.state !== "dead")) {
        Alert.alert(
          "Edição indisponível",
          "Só é possível editar pedidos na fila antes da sincronização.",
        );
        return;
      }
      router.push(`/(tabs)/vendas/offline-edit/${localId}`);
    },
    [router, canEditQueued, rows],
  );

  return {
    rows,
    loading,
    syncing,
    busyId,
    canEditQueued,
    syncNow,
    retryRow,
    discardRow,
    editRow,
    goBack: () => router.back(),
  };
}
