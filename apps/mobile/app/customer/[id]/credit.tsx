import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import { MoneyLabel } from "@/components/molecules/MoneyLabel";
import { useCustomerCreditScreen } from "@/hooks/screens/useCustomerCreditScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle, CheckCircle2, ShoppingCart } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, View } from "react-native";

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.metric}>
      <ThemedText variant="caption" muted>
        {label}
      </ThemedText>
      <ThemedText
        variant="body"
        style={{
          marginTop: 4,
          fontWeight: "700",
          color: accent ?? colors.text,
        }}
        numberOfLines={1}
      >
        {value}
      </ThemedText>
    </View>
  );
}

export default function CustomerCreditScreen() {
  const router = useRouter();
  const { id: customerId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const {
    snap,
    isLoading,
    isFetching,
    refetch,
    policyLabel,
    effectiveActionLabel,
  } = useCustomerCreditScreen();

  const blocked = Boolean(snap?.creditBlocked);

  return (
    <SafeScreen>
      <MobileHeader
        title="Crédito e títulos"
        subtitle="Situação financeira"
        showBack
      />
      {isLoading || !snap ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <MobileScreen
          refreshing={isFetching}
          onRefresh={() => void refetch()}
          noBottomInset
          contentContainerStyle={styles.content}
        >
          <ThemedCard
            style={[
              styles.statusCard,
              {
                borderColor: blocked
                  ? colorWithAlpha(colors.danger, 0.4)
                  : colorWithAlpha(colors.success, 0.35),
                backgroundColor: blocked
                  ? colorWithAlpha(colors.danger, 0.08)
                  : colorWithAlpha(colors.success, 0.08),
              },
            ]}
          >
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusIcon,
                  {
                    backgroundColor: blocked
                      ? colorWithAlpha(colors.danger, 0.18)
                      : colorWithAlpha(colors.success, 0.18),
                  },
                ]}
              >
                {blocked ? (
                  <AlertTriangle size={22} color={colors.danger} />
                ) : (
                  <CheckCircle2 size={22} color={colors.success} />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText variant="titleSm" style={{ fontWeight: "700" }}>
                  {blocked ? "Crédito bloqueado" : "Crédito liberado"}
                </ThemedText>
                <ThemedText variant="bodySm" muted>
                  Política: {policyLabel(snap.creditPolicy)}
                </ThemedText>
              </View>
            </View>
          </ThemedCard>

          <View style={styles.metricsRow}>
            <ThemedCard style={styles.metricCard}>
              <Metric
                label="Limite"
                value={
                  snap.creditLimit != null
                    ? `R$ ${fmtMoney(snap.creditLimit)}`
                    : "Sem limite"
                }
              />
            </ThemedCard>
            <ThemedCard style={styles.metricCard}>
              <Metric
                label="Em aberto"
                value={`R$ ${fmtMoney(snap.openBalance)}`}
                accent={snap.overdueCount > 0 ? colors.warning : undefined}
              />
            </ThemedCard>
          </View>

          {snap.overdueCount > 0 ? (
            <ThemedCard
              style={{
                borderColor: colorWithAlpha(colors.warning, 0.4),
                backgroundColor: colorWithAlpha(colors.warning, 0.08),
              }}
            >
              <ThemedText
                variant="bodySm"
                style={{ color: colors.warning, fontWeight: "700" }}
              >
                {snap.overdueCount} título(s) vencido(s)
              </ThemedText>
              <ThemedText variant="bodySm" muted style={{ marginTop: 4 }}>
                Total vencido: R$ {fmtMoney(snap.overdueAmount)}
              </ThemedText>
            </ThemedCard>
          ) : null}

          {snap.violations.length > 0 ? (
            <ThemedCard style={styles.section}>
              <ThemedText variant="label" style={{ fontWeight: "700" }}>
                Alertas
              </ThemedText>
              {snap.violations.map((v, i) => (
                <ThemedText
                  key={`${v.code}-${i}`}
                  variant="bodySm"
                  style={{ marginTop: i === 0 ? 8 : 6 }}
                >
                  • {v.message}
                </ThemedText>
              ))}
              <ThemedText variant="caption" muted style={{ marginTop: 10 }}>
                {effectiveActionLabel(snap.effectiveAction)}
              </ThemedText>
            </ThemedCard>
          ) : (
            <ThemedText
              variant="bodySm"
              style={{ color: colors.success, fontWeight: "600" }}
            >
              Sem pendências de crédito.
            </ThemedText>
          )}

          <ThemedText variant="titleSm" style={{ marginTop: 4 }}>
            Títulos em aberto
          </ThemedText>

          {snap.titlesOpen.length === 0 ? (
            <ThemedCard>
              <ThemedText variant="bodySm" muted>
                Nenhum título em aberto.
              </ThemedText>
            </ThemedCard>
          ) : (
            snap.titlesOpen.map((t) => (
              <ThemedCard
                key={t.id}
                style={[
                  styles.titleCard,
                  t.overdue
                    ? {
                        borderColor: colorWithAlpha(colors.warning, 0.45),
                      }
                    : undefined,
                ]}
              >
                <View style={styles.titleTop}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <ThemedText variant="body" style={{ fontWeight: "600" }}>
                      {t.reference ?? "Título"}
                    </ThemedText>
                    <ThemedText variant="caption" muted>
                      Venc. {new Date(t.dueDate).toLocaleDateString("pt-BR")}
                    </ThemedText>
                  </View>
                  {t.overdue ? (
                    <View
                      style={[
                        styles.overdueBadge,
                        {
                          backgroundColor: colorWithAlpha(colors.warning, 0.18),
                        },
                      ]}
                    >
                      <ThemedText
                        variant="caption"
                        style={{ color: colors.warning, fontWeight: "800" }}
                      >
                        VENCIDO
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <MoneyLabel amount={t.remaining} fontWeight="700" />
                {t.notes ? (
                  <ThemedText variant="caption" muted>
                    {t.notes}
                  </ThemedText>
                ) : null}
              </ThemedCard>
            ))
          )}

          <ThemedButton
            size="lg"
            style={styles.orderBtn}
            onPress={() =>
              router.push({
                pathname: "/quick-sale",
                params: customerId ? { customerId } : {},
              })
            }
          >
            <View style={styles.btnInner}>
              <ShoppingCart size={18} color={colors.primaryForeground} />
              <ThemedText
                variant="body"
                style={{
                  color: colors.primaryForeground,
                  fontWeight: "700",
                }}
              >
                Fazer pedido
              </ThemedText>
            </View>
          </ThemedButton>
        </MobileScreen>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { gap: 12, paddingBottom: 32 },
  statusCard: { gap: 0 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: radiiPx.md,
    alignItems: "center",
    justifyContent: "center",
  },
  metricsRow: { flexDirection: "row", gap: 10 },
  metricCard: { flex: 1 },
  metric: { gap: 0 },
  section: { gap: 0 },
  titleCard: { gap: 8 },
  titleTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  overdueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderBtn: { marginTop: 8, minHeight: 52 },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
