import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "../../context/ConfirmContext";
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
  const { confirm, alert } = useConfirm();
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
      void (async () => {
        const ok = await confirm({
          title: "Repetir envio?",
          description: "O servidor vai recalcular preços e crédito.",
          confirmLabel: "Enviar",
          cancelLabel: "Cancelar",
          tone: "default",
        });
        if (!ok) return;
        setBusyId(localId);
        try {
          await reviveOfflineSaleRow(localId);
          refresh();
          await load();
          await syncNow();
        } finally {
          setBusyId(null);
        }
      })();
    },
    [confirm, load, refresh, syncNow],
  );

  const discardRow = useCallback(
    (localId: string) => {
      void (async () => {
        const ok = await confirm({
          title: "Remover pedido da fila?",
          description: "Perde este registo offline.",
          confirmLabel: "Remover",
          cancelLabel: "Cancelar",
          tone: "destructive",
        });
        if (!ok) return;
        setBusyId(localId);
        try {
          await deleteOfflineSaleRow(localId);
          refresh();
          await load();
        } finally {
          setBusyId(null);
        }
      })();
    },
    [confirm, load, refresh],
  );

  const editRow = useCallback(
    (localId: string) => {
      if (!canEditQueued) return;
      const row = rows.find((r) => r.localId === localId);
      // Só pedidos ainda locais (fila / erro de validação) — nunca vendas já sincronizadas.
      if (!row || (row.state !== "queued" && row.state !== "dead")) {
        void alert({
          title: "Edição indisponível",
          description:
            "Só é possível editar pedidos na fila antes da sincronização.",
        });
        return;
      }
      router.push(`/(tabs)/vendas/offline-edit/${localId}`);
    },
    [alert, router, canEditQueued, rows],
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
