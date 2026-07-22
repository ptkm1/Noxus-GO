import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { fmtMoney } from "@/components/atoms/formatMoney";
import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import { useOfflineQueueScreen } from "@/hooks/screens/useOfflineQueueScreen";
import { useOrderSyncMode } from "@/hooks/useOrderSyncMode";
import { useTheme } from "@/lib/theme";
import { offlineQueueStateLabel } from "@/lib/utils/offline-queue-state";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

export default function OfflineQueueScreen() {
  const { colors } = useTheme();
  const { orderSyncMode } = useOrderSyncMode();
  const {
    rows,
    loading,
    syncing,
    busyId,
    canEditQueued,
    syncNow,
    retryRow,
    discardRow,
    editRow,
  } = useOfflineQueueScreen();
  const actionsBusy = syncing || busyId != null;
  const manual = orderSyncMode === "MANUAL";

  return (
    <SafeScreen variant="tab">
      <MobileHeader
        title="Fila offline"
        subtitle={
          manual
            ? "Pedidos aguardando envio manual"
            : "Pedidos guardados sem rede"
        }
        showBack
      />
      <MobileScreen scroll noBottomInset>
        <ThemedText variant="bodySm" muted>
          {manual
            ? "Envio manual ativo: os pedidos ficam nesta fila até você tocar em Sincronizar agora — mesmo com internet."
            : "Pedidos guardados sem rede são enviados quando a ligação volta. Em caso de erro de política, pode tentar de novo ou apagar."}
          {canEditQueued
            ? " Editar só está disponível antes da sincronização; após o envio o pedido não pode mais ser alterado."
            : ""}
        </ThemedText>

        <ThemedButton
          loading={syncing}
          loadingLabel="Sincronizando…"
          onPress={() => void syncNow()}
        >
          Sincronizar agora
        </ThemedButton>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : rows.length === 0 ? (
          <ThemedText variant="bodySm" muted style={{ textAlign: "center" }}>
            Nada na fila.
          </ThemedText>
        ) : (
          rows.map((row) => {
            const rowBusy = busyId === row.localId;
            const canEditRow =
              canEditQueued &&
              (row.state === "queued" || row.state === "dead");
            return (
              <ThemedCard key={row.localId}>
                <ThemedText
                  variant="caption"
                  style={{
                    fontWeight: "700",
                    color: colors.primary,
                    marginBottom: 6,
                  }}
                >
                  {offlineQueueStateLabel(row.state)}
                </ThemedText>
                <ThemedText variant="caption" muted>
                  {new Date(row.createdAtMs).toLocaleString("pt-BR")}
                  {row.attempts > 0 ? ` · ${row.attempts} tentativa(s)` : ""}
                </ThemedText>
                <ThemedText
                  variant="body"
                  style={{ marginTop: 6, fontWeight: "600" }}
                >
                  {row.payload.snapshot?.customerLabel ?? "Consumidor avulso"}
                </ThemedText>
                {row.payload.snapshot?.cartTotalApprox != null ? (
                  <ThemedText variant="bodySm" muted>
                    R$ {fmtMoney(row.payload.snapshot.cartTotalApprox)}
                  </ThemedText>
                ) : null}
                {row.lastError ? (
                  <ThemedText
                    variant="caption"
                    style={{ color: colors.danger, marginTop: 6 }}
                  >
                    {row.lastError}
                  </ThemedText>
                ) : null}
                <View style={styles.actions}>
                  {rowBusy ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : null}
                  {canEditRow ? (
                    <Pressable
                      disabled={actionsBusy}
                      onPress={() => editRow(row.localId)}
                      style={actionsBusy ? styles.actionDis : undefined}
                    >
                      <ThemedText
                        style={{ color: colors.primary, fontWeight: "600" }}
                      >
                        Editar (antes do envio)
                      </ThemedText>
                    </Pressable>
                  ) : null}
                  {row.state === "dead" ? (
                    <Pressable
                      disabled={actionsBusy}
                      onPress={() => void retryRow(row.localId)}
                      style={actionsBusy ? styles.actionDis : undefined}
                    >
                      <ThemedText
                        style={{ color: colors.primary, fontWeight: "600" }}
                      >
                        Tentar de novo
                      </ThemedText>
                    </Pressable>
                  ) : null}
                  <Pressable
                    disabled={actionsBusy}
                    onPress={() => discardRow(row.localId)}
                    style={actionsBusy ? styles.actionDis : undefined}
                  >
                    <ThemedText
                      style={{ color: colors.danger, fontWeight: "600" }}
                    >
                      Apagar
                    </ThemedText>
                  </Pressable>
                </View>
              </ThemedCard>
            );
          })
        )}
      </MobileScreen>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  actionDis: { opacity: 0.45 },
});
