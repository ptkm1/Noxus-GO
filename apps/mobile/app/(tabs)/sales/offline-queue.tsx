import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fmtMoney } from "../../../components/atoms/formatMoney";
import { useOfflineQueueScreen } from "../../../hooks/screens/useOfflineQueueScreen";
import { offlineQueueStateLabel } from "../../../lib/utils/offline-queue-state";

export default function OfflineQueueScreen() {
  const { rows, loading, syncing, syncNow, retryRow, discardRow, goBack } = useOfflineQueueScreen();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.pad}>
      <Text style={styles.lead}>
        Pedidos guardados sem rede são enviados automaticamente quando a ligação volta. Se algo falhar por política da
        empresa (crédito, preço inválido), o pedido fica marcado como erro — pode tentar de novo ou apagar.
      </Text>

      <Pressable
        style={[styles.syncBtn, syncing && styles.syncBtnDis]}
        disabled={syncing}
        onPress={() => void syncNow()}
      >
        {syncing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.syncTxt}>Sincronizar agora</Text>
        )}
      </Pressable>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>Nada na fila.</Text>
      ) : (
        rows.map((row) => (
          <View key={row.localId} style={styles.card}>
            <Text style={styles.stateChip}>{offlineQueueStateLabel(row.state)}</Text>
            <Text style={styles.meta}>ID local · {row.localId.slice(0, 18)}…</Text>
            <Text style={styles.meta}>
              Criado · {new Date(row.createdAtMs).toLocaleString("pt-BR")}
              {row.attempts > 0 ? ` · tentativas ${row.attempts}` : ""}
            </Text>
            {row.payload.snapshot?.customerLabel ? (
              <Text style={styles.customer}>Cliente · {row.payload.snapshot.customerLabel}</Text>
            ) : (
              <Text style={styles.customer}>Cliente · consumidor avulso</Text>
            )}
            {row.payload.snapshot?.cartTotalApprox != null ? (
              <Text style={styles.total}>
                Total (referência guardada) · R$ {fmtMoney(row.payload.snapshot.cartTotalApprox)}
              </Text>
            ) : null}
            {(row.payload.snapshot?.lineSummaries ?? []).slice(0, 8).map((line, i) => (
              <Text key={i} style={styles.line}>
                • {line}
              </Text>
            ))}
            {row.lastError ? <Text style={styles.err}>{row.lastError}</Text> : null}
            <View style={styles.actions}>
              {row.state === "dead" ? (
                <Pressable style={styles.secondaryBtn} onPress={() => retryRow(row.localId)}>
                  <Text style={styles.secondaryTxt}>Tentar de novo</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.dangerBtn} onPress={() => discardRow(row.localId)}>
                <Text style={styles.dangerTxt}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Pressable style={styles.back} onPress={goBack}>
        <Text style={styles.backTxt}>← Voltar às vendas</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  pad: { padding: 16, paddingBottom: 48 },
  lead: { fontSize: 13, color: "#475569", lineHeight: 19, marginBottom: 14 },
  syncBtn: {
    backgroundColor: "#0284c7",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  syncBtnDis: { opacity: 0.6 },
  syncTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  empty: { marginTop: 32, textAlign: "center", color: "#94a3b8" },
  card: {
    marginTop: 14,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  stateChip: { fontSize: 12, fontWeight: "700", color: "#0369a1", marginBottom: 4 },
  meta: { fontSize: 12, color: "#64748b" },
  customer: { marginTop: 6, fontSize: 15, fontWeight: "600", color: "#0f172a" },
  total: { fontSize: 13, fontWeight: "600", color: "#334155" },
  line: { fontSize: 13, color: "#475569", marginLeft: 4 },
  err: { marginTop: 8, fontSize: 12, color: "#b91c1c" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  secondaryTxt: { fontWeight: "600", color: "#334155", fontSize: 13 },
  dangerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  dangerTxt: { fontWeight: "600", color: "#991b1b", fontSize: 13 },
  back: { marginTop: 28 },
  backTxt: { color: "#0284c7", fontWeight: "600", fontSize: 15 },
});
