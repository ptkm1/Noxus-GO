import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { MoneyLabel } from "../../../components/molecules/MoneyLabel";
import { useSaleDetailScreen } from "../../../hooks/screens/useSaleDetailScreen";
import { orderStatusDetailLabel } from "../../../lib/utils/order-status";

export default function SaleDetailScreen() {
  const { order, isLoading } = useSaleDetailScreen();

  if (isLoading || !order) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.meta}>
        {new Date(order.createdAt).toLocaleString("pt-BR")} · {orderStatusDetailLabel(order.status)}
      </Text>
      <Text style={styles.customer}>{order.customer?.name ?? "Sem cliente"}</Text>
      {order.creditHoldReasons != null ? (
        <Text style={styles.creditHold}>
          Motivos de crédito:{" "}
          {typeof order.creditHoldReasons === "string"
            ? order.creditHoldReasons
            : JSON.stringify(order.creditHoldReasons)}
        </Text>
      ) : null}
      {order.notes ? <Text style={styles.notes}>{order.notes}</Text> : null}
      <Text style={styles.h2}>Itens</Text>
      {order.items.map((it) => (
        <View key={it.id} style={styles.line}>
          <Text style={styles.pn}>
            {it.productName} × {it.quantity}
          </Text>
          <MoneyLabel amount={Number(it.unitPrice) * it.quantity} style={styles.price} />
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.total}>Total:</Text>
        <MoneyLabel amount={Number(order.totalAmount)} style={styles.total} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32 },
  meta: { fontSize: 13, color: "#64748b" },
  customer: { fontSize: 20, fontWeight: "700", marginTop: 8, color: "#0f172a" },
  notes: { marginTop: 8, color: "#475569" },
  creditHold: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
    fontSize: 13,
    color: "#92400e",
  },
  h2: { marginTop: 24, fontSize: 16, fontWeight: "600", color: "#0f172a" },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  pn: { flex: 1, fontSize: 15, color: "#334155" },
  price: { fontSize: 15, fontWeight: "500" },
  totalRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
    gap: 6,
  },
  total: { fontSize: 18, fontWeight: "700", textAlign: "right" },
});
