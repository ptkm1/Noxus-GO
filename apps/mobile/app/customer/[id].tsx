import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen } from "@/components/layout";
import { MoneyLabel } from "@/components/molecules/MoneyLabel";
import { useCustomerCreditScreen } from "@/hooks/screens/useCustomerCreditScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";

export default function CustomerCreditScreen() {
  const router = useRouter();
  const { id: customerId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { snap, isLoading, isFetching, refetch, policyLabel, effectiveActionLabel } =
    useCustomerCreditScreen();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MobileHeader title="Cliente" subtitle="Crédito e títulos" showBack />
      <MobileScreen refreshing={isFetching} onRefresh={() => void refetch()}>
        {isLoading || !snap ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <ThemedText variant="caption" muted>
              Política: {policyLabel(snap.creditPolicy)}
            </ThemedText>

            <ThemedCard
              style={
                snap.creditBlocked
                  ? {
                      borderColor: colorWithAlpha(colors.danger, 0.4),
                      backgroundColor: colorWithAlpha(colors.danger, 0.06),
                    }
                  : {
                      borderColor: colorWithAlpha(colors.success, 0.3),
                      backgroundColor: colorWithAlpha(colors.success, 0.06),
                    }
              }
            >
              <ThemedText variant="titleSm">Status de crédito</ThemedText>
              <ThemedText variant="body" style={{ marginTop: 8 }}>
                {snap.creditBlocked ? "Bloqueado para novas vendas" : "Não bloqueado"}
              </ThemedText>
              <ThemedText variant="bodySm" muted style={{ marginTop: 4 }}>
                Limite:{" "}
                {snap.creditLimit != null ? `R$ ${fmtMoney(snap.creditLimit)}` : "Sem limite"}
              </ThemedText>
              <ThemedText variant="bodySm" muted>
                Saldo em aberto: R$ {fmtMoney(snap.openBalance)}
              </ThemedText>
              {snap.overdueCount > 0 ? (
                <ThemedText variant="bodySm" style={{ color: colors.warning, marginTop: 6 }}>
                  {snap.overdueCount} título(s) vencido(s) · R$ {fmtMoney(snap.overdueAmount)}
                </ThemedText>
              ) : null}
            </ThemedCard>

            {snap.violations.length > 0 ? (
              <ThemedCard>
                <ThemedText variant="titleSm">Alertas</ThemedText>
                {snap.violations.map((v, i) => (
                  <ThemedText key={`${v.code}-${i}`} variant="bodySm" style={{ marginTop: 6 }}>
                    • {v.message}
                  </ThemedText>
                ))}
                <ThemedText variant="caption" muted style={{ marginTop: 8 }}>
                  {effectiveActionLabel(snap.effectiveAction)}
                </ThemedText>
              </ThemedCard>
            ) : (
              <ThemedText variant="bodySm" style={{ color: colors.success }}>
                Sem pendências de crédito.
              </ThemedText>
            )}

            <ThemedText variant="titleSm">Títulos em aberto</ThemedText>
            {snap.titlesOpen.length === 0 ? (
              <ThemedText variant="bodySm" muted>
                Nenhum título em aberto.
              </ThemedText>
            ) : (
              snap.titlesOpen.map((t) => (
                <ThemedCard
                  key={t.id}
                  style={
                    t.overdue
                      ? { borderColor: colorWithAlpha(colors.warning, 0.4) }
                      : undefined
                  }
                >
                  <ThemedText variant="body" style={{ fontWeight: "600" }}>
                    {t.reference ?? "Título"} · venc. {new Date(t.dueDate).toLocaleDateString("pt-BR")}
                    {t.overdue ? " · VENCIDO" : ""}
                  </ThemedText>
                  <MoneyLabel amount={t.remaining} />
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
              onPress={() =>
                router.push({
                  pathname: "/quick-sale",
                  params: customerId ? { customerId } : {},
                })
              }
            >
              Fazer pedido
            </ThemedButton>
          </>
        )}
      </MobileScreen>
    </View>
  );
}
