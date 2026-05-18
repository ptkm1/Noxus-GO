import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Target, TrendingUp, Trophy } from "lucide-react-native";
import { fmtMoney } from "../../components/atoms/formatMoney";
import { useCommissionScreen } from "../../hooks/screens/useCommissionScreen";

export default function CommissionScreen() {
  const { insets, data, isLoading, isFetching, isError, onRefresh } = useCommissionScreen();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} />}
    >
      {isLoading && !data ? <ActivityIndicator style={{ marginTop: 40 }} color="#0284c7" /> : null}

      {data ? (
        <>
          <Text style={styles.period}>{data.period.label}</Text>
          <Text style={styles.heroHint}>Faturamento confirmado no mês</Text>
          <Text style={styles.heroValue}>R$ {fmtMoney(data.mtd.confirmedRevenue)}</Text>

          <View style={styles.rowCards}>
            <View style={[styles.miniCard, styles.miniGrow]}>
              <TrendingUp size={18} color="#0284c7" strokeWidth={2.2} />
              <Text style={styles.miniLabel}>Comissão (registrada)</Text>
              <Text style={styles.miniVal}>R$ {fmtMoney(data.mtd.commissionRecorded)}</Text>
            </View>
            <View style={[styles.miniCard, styles.miniGrow]}>
              <Target size={18} color="#047857" strokeWidth={2.2} />
              <Text style={styles.miniLabel}>Linha base</Text>
              <Text style={styles.miniVal}>{data.baselineCommissionPercent.toFixed(1)}%</Text>
            </View>
          </View>

          <View style={styles.rulesStrip}>
            <Text style={styles.rulesTxt}>
              SKU {data.rulesSummary.productRulesCount} · Cat. {data.rulesSummary.categoryRulesCount} · Geral{" "}
              {data.rulesSummary.generalRulesCount}
            </Text>
            <Text style={styles.rulesTxtMuted}>
              Faixas progressivas: {data.rulesSummary.progressiveTierCount}
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <TrendingUp size={20} color="#0f172a" strokeWidth={2} />
              <Text style={styles.sectionTitle}>Comissão progressiva</Text>
            </View>
            {data.progressive.ladder.length === 0 ? (
              <Text style={styles.muted}>Sem faixas configuradas — usa só o % cadastro/regras fixas.</Text>
            ) : (
              <>
                {data.progressive.ladder.map((step) => (
                  <View key={step.id} style={[styles.tierRow, step.achieved && styles.tierRowDone]}>
                    <View style={[styles.dot, step.achieved && styles.dotOn]} />
                    <View style={styles.tierMain}>
                      <Text style={styles.tierTitle}>
                        {step.label ?? `A partir de R$ ${fmtMoney(step.thresholdAmount)}`}
                      </Text>
                      <Text style={styles.tierSub}>
                        {step.commissionPercent.toFixed(1)}% ·{" "}
                        {step.scope === "ORG" ? "Organização" : "Teu plano"}
                      </Text>
                    </View>
                    {step.achieved ? <Text style={styles.badgeOk}>✓</Text> : null}
                  </View>
                ))}
                {data.progressive.nextTier && data.progressive.gapToNextAmount != null ? (
                  <Text style={styles.nextGap}>
                    Falta R$ {fmtMoney(data.progressive.gapToNextAmount)} para a próxima faixa (
                    {data.progressive.nextTier.commissionPercent.toFixed(1)}%).
                  </Text>
                ) : data.progressive.activeTier && !data.progressive.nextTier ? (
                  <Text style={styles.nextGap}>Estás na faixa máxima deste período.</Text>
                ) : null}
              </>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Target size={20} color="#0f172a" strokeWidth={2} />
              <Text style={styles.sectionTitle}>Meta</Text>
            </View>
            {!data.goal ? (
              <Text style={styles.muted}>Sem meta definida para este mês (admin pode criar).</Text>
            ) : (
              <>
                <Text style={styles.goalTitle}>{data.goal.title}</Text>
                <Text style={styles.goalNums}>
                  R$ {fmtMoney(data.goal.achievedAmount)} / R${" "}
                  {data.goal.targetAmount != null ? fmtMoney(data.goal.targetAmount) : "—"}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(100, data.goal.progressPercent ?? 0)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.goalPct}>{(data.goal.progressPercent ?? 0).toFixed(0)}%</Text>
              </>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Trophy size={20} color="#0f172a" strokeWidth={2} />
              <Text style={styles.sectionTitle}>Ranking do mês</Text>
            </View>
            <Text style={styles.rankPos}>
              {data.ranking.position != null
                ? `Teu lugar: ${data.ranking.position}º de ${data.ranking.totalSellers}`
                : `Sem posição (${data.ranking.totalSellers} vendedores)`}
            </Text>
            {data.ranking.top.map((row) => (
              <View key={`${row.rank}-${row.name}`} style={[styles.rankRow, row.isMe && styles.rankRowMe]}>
                <Text style={styles.rankNum}>{row.rank}º</Text>
                <Text style={[styles.rankName, row.isMe && styles.rankNameMe]} numberOfLines={1}>
                  {row.name}
                  {row.isMe ? " (tu)" : ""}
                </Text>
                <Text style={styles.rankAmt}>R$ {fmtMoney(row.totalAmount)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : isError ? (
        <Text style={styles.err}>Não foi possível carregar. Puxa para atualizar.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16 },
  period: { fontSize: 14, fontWeight: "700", color: "#64748b", textTransform: "capitalize" },
  heroHint: { marginTop: 8, fontSize: 13, color: "#64748b" },
  heroValue: { marginTop: 4, fontSize: 34, fontWeight: "800", color: "#0284c7" },
  rowCards: { flexDirection: "row", gap: 10, marginTop: 16 },
  miniGrow: { flex: 1 },
  miniCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  miniLabel: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  miniVal: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  rulesStrip: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rulesTxt: { fontSize: 12, color: "#334155", fontWeight: "600" },
  rulesTxtMuted: { marginTop: 4, fontSize: 11, color: "#64748b" },
  section: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  muted: { fontSize: 13, color: "#64748b", lineHeight: 18 },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  tierRowDone: { backgroundColor: "#f0fdf4" },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#cbd5e1",
    marginRight: 12,
  },
  dotOn: { backgroundColor: "#22c55e" },
  tierMain: { flex: 1 },
  tierTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  tierSub: { marginTop: 2, fontSize: 12, color: "#64748b" },
  badgeOk: { fontSize: 16, fontWeight: "800", color: "#15803d" },
  nextGap: { marginTop: 12, fontSize: 13, color: "#b45309", fontWeight: "600", lineHeight: 18 },
  goalTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  goalNums: { marginTop: 6, fontSize: 13, color: "#64748b" },
  barTrack: {
    marginTop: 10,
    height: 12,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: "#0284c7", borderRadius: 8 },
  goalPct: { marginTop: 6, fontSize: 12, fontWeight: "700", color: "#0284c7", textAlign: "right" },
  rankPos: { fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 10 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  rankRowMe: { backgroundColor: "#e0f2fe", marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  rankNum: { width: 28, fontWeight: "800", color: "#64748b" },
  rankName: { flex: 1, fontSize: 14, color: "#0f172a" },
  rankNameMe: { fontWeight: "800", color: "#0369a1" },
  rankAmt: { fontSize: 13, fontWeight: "700", color: "#047857" },
  err: { marginTop: 24, color: "#dc2626", textAlign: "center" },
});
