import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import { ProgressStat, StatCard } from "@/components/molecules/StatCard";
import { useCommissionScreen } from "@/hooks/screens/useCommissionScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import { Target, TrendingUp, Trophy } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function CommissionScreen() {
  const { colors } = useTheme();
  const { data, isLoading, isFetching, isError, onRefresh } =
    useCommissionScreen();

  return (
    <SafeScreen variant="tab">
      <MobileHeader title="Comissão" subtitle={data?.period.label} showBack />
      <MobileScreen refreshing={isFetching} onRefresh={onRefresh}>
        {isLoading && !data ? (
          <ActivityIndicator color={colors.primary} />
        ) : null}

        {data ? (
          <>
            <ThemedText variant="caption" muted>
              Faturamento confirmado no mês
            </ThemedText>
            <ThemedText
              variant="display"
              style={{ color: colors.primary, fontSize: 32 }}
            >
              R$ {fmtMoney(data.mtd.confirmedRevenue)}
            </ThemedText>

            <View style={styles.row}>
              <View style={styles.half}>
                <StatCard
                  title="Comissão"
                  value={`R$ ${fmtMoney(data.mtd.commissionRecorded)}`}
                  icon={TrendingUp}
                />
              </View>
              <View style={styles.half}>
                <StatCard
                  title="Linha base"
                  value={`${data.baselineCommissionPercent.toFixed(1)}%`}
                  icon={Target}
                />
              </View>
            </View>

            <ThemedCard>
              <ThemedText variant="bodySm" style={{ fontWeight: "600" }}>
                Regras: SKU {data.rulesSummary.productRulesCount} · Cat.{" "}
                {data.rulesSummary.categoryRulesCount} · Geral{" "}
                {data.rulesSummary.generalRulesCount}
              </ThemedText>
              <ThemedText variant="caption" muted style={{ marginTop: 4 }}>
                Faixas progressivas: {data.rulesSummary.progressiveTierCount}
              </ThemedText>
            </ThemedCard>

            <ThemedCard>
              <View style={styles.sectionHead}>
                <TrendingUp color={colors.text} size={20} />
                <ThemedText variant="titleSm">Comissão progressiva</ThemedText>
              </View>
              {data.progressive.ladder.length === 0 ? (
                <ThemedText variant="bodySm" muted>
                  Sem faixas configuradas.
                </ThemedText>
              ) : (
                data.progressive.ladder.map((step) => (
                  <View
                    key={step.id}
                    style={[
                      styles.tierRow,
                      step.achieved && {
                        backgroundColor: colorWithAlpha(colors.success, 0.08),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: step.achieved
                            ? colors.success
                            : colors.border,
                        },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <ThemedText variant="body" style={{ fontWeight: "600" }}>
                        {step.label ??
                          `A partir de R$ ${fmtMoney(step.thresholdAmount)}`}
                      </ThemedText>
                      <ThemedText variant="caption" muted>
                        {step.commissionPercent.toFixed(1)}% ·{" "}
                        {step.scope === "ORG" ? "Organização" : "Teu plano"}
                      </ThemedText>
                    </View>
                    {step.achieved ? (
                      <ThemedText
                        style={{ color: colors.success, fontWeight: "700" }}
                      >
                        ✓
                      </ThemedText>
                    ) : null}
                  </View>
                ))
              )}
            </ThemedCard>

            {data.goal && data.goal.targetAmount != null ? (
              <ProgressStat
                title={data.goal.title}
                current={data.goal.achievedAmount}
                target={data.goal.targetAmount}
                formatValue={(v) => `R$ ${fmtMoney(v)}`}
              />
            ) : (
              <ThemedCard>
                <ThemedText variant="bodySm" muted>
                  Sem meta definida para este mês.
                </ThemedText>
              </ThemedCard>
            )}

            <ThemedCard>
              <View style={styles.sectionHead}>
                <Trophy color={colors.text} size={20} />
                <ThemedText variant="titleSm">Ranking do mês</ThemedText>
              </View>
              <ThemedText
                variant="body"
                style={{ fontWeight: "600", marginBottom: 10 }}
              >
                {data.ranking.position != null
                  ? `${data.ranking.position}º de ${data.ranking.totalSellers}`
                  : `Sem posição (${data.ranking.totalSellers} vendedores)`}
              </ThemedText>
              {data.ranking.top.map((row) => (
                <View
                  key={`${row.rank}-${row.name}`}
                  style={[
                    styles.rankRow,
                    row.isMe && {
                      backgroundColor: colorWithAlpha(colors.primary, 0.1),
                    },
                  ]}
                >
                  <ThemedText
                    variant="bodySm"
                    muted
                    style={{ width: 28, fontWeight: "700" }}
                  >
                    {row.rank}º
                  </ThemedText>
                  <ThemedText
                    variant="body"
                    style={{ flex: 1, fontWeight: row.isMe ? "700" : "400" }}
                    numberOfLines={1}
                  >
                    {row.name}
                    {row.isMe ? " (tu)" : ""}
                  </ThemedText>
                  <ThemedText
                    variant="bodySm"
                    style={{ color: colors.success, fontWeight: "600" }}
                  >
                    R$ {fmtMoney(row.totalAmount)}
                  </ThemedText>
                </View>
              ))}
            </ThemedCard>
          </>
        ) : isError ? (
          <ThemedText style={{ color: colors.danger, textAlign: "center" }}>
            Não foi possível carregar. Puxa para atualizar.
          </ThemedText>
        ) : null}
      </MobileScreen>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1, minWidth: 0 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
    borderRadius: radiiPx.md,
    paddingHorizontal: 4,
  },
});
