import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen } from "@/components/layout";
import { MoneyLabel } from "@/components/molecules/MoneyLabel";
import { useSaleDetailScreen } from "@/hooks/screens/useSaleDetailScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { orderStatusDetailLabel } from "@/lib/utils/order-status";

export default function SaleDetailScreen() {
  const { colors } = useTheme();
  const { order, isLoading } = useSaleDetailScreen();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MobileHeader title="Detalhe da venda" showBack />
      {isLoading || !order ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <MobileScreen scroll noBottomInset>
          <ThemedText variant="caption" muted>
            {new Date(order.createdAt).toLocaleString("pt-BR")} ·{" "}
            {orderStatusDetailLabel(order.status)}
          </ThemedText>
          <ThemedText variant="title">{order.customer?.name ?? "Sem cliente"}</ThemedText>
          {order.creditHoldReasons != null ? (
            <ThemedCard
              style={{
                borderColor: colorWithAlpha(colors.warning, 0.4),
                backgroundColor: colorWithAlpha(colors.warning, 0.08),
              }}
            >
              <ThemedText variant="bodySm" style={{ color: colors.warning }}>
                Motivos de crédito:{" "}
                {typeof order.creditHoldReasons === "string"
                  ? order.creditHoldReasons
                  : JSON.stringify(order.creditHoldReasons)}
              </ThemedText>
            </ThemedCard>
          ) : null}
          {order.notes ? (
            <ThemedText variant="bodySm" muted>
              {order.notes}
            </ThemedText>
          ) : null}

          <ThemedText variant="titleSm">Itens</ThemedText>
          {order.items.map((it) => (
            <View
              key={it.id}
              style={[styles.line, { borderBottomColor: colors.border }]}
            >
              <ThemedText variant="body" style={{ flex: 1 }}>
                {it.productName} × {it.quantity}
              </ThemedText>
              <MoneyLabel amount={Number(it.unitPrice) * it.quantity} />
            </View>
          ))}
          <View style={styles.totalRow}>
            <ThemedText variant="titleSm">Total</ThemedText>
            <MoneyLabel amount={Number(order.totalAmount)} />
          </View>
        </MobileScreen>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
});
