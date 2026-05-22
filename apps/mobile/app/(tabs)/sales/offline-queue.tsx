import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { fmtMoney } from "@/components/atoms/formatMoney";
import { MobileHeader, MobileScreen } from "@/components/layout";
import { useOfflineQueueScreen } from "@/hooks/screens/useOfflineQueueScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { offlineQueueStateLabel } from "@/lib/utils/offline-queue-state";

export default function OfflineQueueScreen() {
  const { colors } = useTheme();
  const { rows, loading, syncing, syncNow, retryRow, discardRow } = useOfflineQueueScreen();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MobileHeader title="Fila offline" subtitle="Pedidos guardados sem rede" showBack />
      <MobileScreen scroll noBottomInset>
        <ThemedText variant="bodySm" muted>
          Pedidos guardados sem rede são enviados quando a ligação volta. Em caso de erro de política,
          pode tentar de novo ou apagar.
        </ThemedText>

        <ThemedButton disabled={syncing} onPress={() => void syncNow()}>
          {syncing ? "Sincronizando…" : "Sincronizar agora"}
        </ThemedButton>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : rows.length === 0 ? (
          <ThemedText variant="bodySm" muted style={{ textAlign: "center" }}>
            Nada na fila.
          </ThemedText>
        ) : (
          rows.map((row) => (
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
              <ThemedText variant="body" style={{ marginTop: 6, fontWeight: "600" }}>
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
                {row.state === "dead" ? (
                  <Pressable onPress={() => void retryRow(row.localId)}>
                    <ThemedText style={{ color: colors.primary, fontWeight: "600" }}>
                      Tentar de novo
                    </ThemedText>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => discardRow(row.localId)}>
                  <ThemedText style={{ color: colors.danger, fontWeight: "600" }}>
                    Apagar
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedCard>
          ))
        )}
      </MobileScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 16, marginTop: 12 },
});
