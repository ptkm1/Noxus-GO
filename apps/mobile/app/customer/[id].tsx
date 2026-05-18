import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fmtMoney } from "../../components/atoms/formatMoney";
import { MoneyLabel } from "../../components/molecules/MoneyLabel";
import { useCustomerCreditScreen } from "../../hooks/screens/useCustomerCreditScreen";

export default function CustomerCreditScreen() {
  const { snap, isLoading, isFetching, refetch, policyLabel, effectiveActionLabel } =
    useCustomerCreditScreen();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />}
    >
      {isLoading || !snap ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#0284c7" />
      ) : (
        <>
          <Text style={styles.h1}>Crédito do cliente</Text>
          <Text style={styles.policy}>Política da empresa: {policyLabel(snap.creditPolicy)}</Text>

          <View style={[styles.card, snap.creditBlocked ? styles.cardDanger : styles.cardOk]}>
            <Text style={styles.cardTitle}>Status</Text>
            <Text style={styles.cardTxt}>
              {snap.creditBlocked ? "Bloqueado para novas vendas" : "Não está bloqueado"}
            </Text>
            <Text style={styles.cardTxt}>
              Limite:{" "}
              {snap.creditLimit != null ? `R$ ${fmtMoney(snap.creditLimit)}` : "Sem limite configurado"}
            </Text>
            <Text style={styles.cardTxt}>Saldo em aberto: R$ {fmtMoney(snap.openBalance)}</Text>
            {snap.overdueCount > 0 ? (
              <Text style={styles.cardWarn}>
                {snap.overdueCount} título(s) vencido(s) · R$ {fmtMoney(snap.overdueAmount)}
              </Text>
            ) : (
              <Text style={styles.cardTxtMuted}>Sem títulos vencidos em aberto.</Text>
            )}
          </View>

          {snap.violations.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.h2}>Alertas para este valor no pedido</Text>
              {snap.violations.map((v, i) => (
                <Text key={`${v.code}-${i}`} style={styles.bullet}>
                  • {v.message}
                </Text>
              ))}
              <Text style={styles.effect}>Comportamento: {effectiveActionLabel(snap.effectiveAction)}</Text>
            </View>
          ) : (
            <Text style={styles.ok}>Sem pendências de crédito neste momento.</Text>
          )}

          <Text style={styles.h2}>Títulos em aberto</Text>
          {snap.titlesOpen.length === 0 ? (
            <Text style={styles.muted}>Nenhum título em aberto cadastrado.</Text>
          ) : (
            snap.titlesOpen.map((t) => (
              <View key={t.id} style={[styles.titleRow, t.overdue && styles.titleRowBad]}>
                <Text style={styles.titleMain}>
                  {t.reference ?? "Título"} · venc. {new Date(t.dueDate).toLocaleDateString("pt-BR")}
                  {t.overdue ? " · VENCIDO" : ""}
                </Text>
                <MoneyLabel amount={t.remaining} style={styles.titleAmt} />
                {t.notes ? <Text style={styles.titleNotes}>{t.notes}</Text> : null}
              </View>
            ))
          )}

          <Text style={[styles.h2, { marginTop: 20 }]}>Histórico recente</Text>
          {snap.titlesHistory.length === 0 ? (
            <Text style={styles.muted}>Sem títulos quitados/cancelados recentes.</Text>
          ) : (
            snap.titlesHistory.map((t) => (
              <View key={t.id} style={styles.titleRowMuted}>
                <Text style={styles.titleMain}>
                  {t.reference ?? "—"} · {t.status} · {new Date(t.dueDate).toLocaleDateString("pt-BR")}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  policy: { marginTop: 6, fontSize: 13, color: "#475569" },
  card: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  cardOk: {},
  cardDanger: { borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  cardTxt: { fontSize: 14, color: "#334155", marginBottom: 4 },
  cardTxtMuted: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  cardWarn: { marginTop: 6, fontSize: 14, fontWeight: "700", color: "#b45309" },
  section: { marginTop: 16 },
  h2: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  bullet: { fontSize: 13, color: "#475569", marginBottom: 4 },
  effect: { marginTop: 10, fontSize: 13, fontWeight: "600", color: "#0369a1" },
  ok: { marginTop: 12, fontSize: 14, color: "#059669", fontWeight: "600" },
  muted: { fontSize: 13, color: "#94a3b8", marginBottom: 8 },
  titleRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  titleRowBad: { borderColor: "#fca5a5", backgroundColor: "#fff7ed" },
  titleMain: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  titleAmt: { marginTop: 6, fontSize: 15, fontWeight: "800", color: "#b45309" },
  titleNotes: { marginTop: 6, fontSize: 12, color: "#64748b" },
  titleRowMuted: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
});
