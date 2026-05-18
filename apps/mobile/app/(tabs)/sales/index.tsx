import { Link } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SellerOfflineQueueBanner } from "../../../components/organisms/SellerOfflineQueueBanner";
import { SellerSalesToolbarFab } from "../../../components/organisms/SellerSalesToolbarFab";
import { fmtMoney } from "../../../components/atoms/formatMoney";
import { useSalesListScreen } from "../../../hooks/screens/useSalesListScreen";
import { orderStatusBadgeLabel } from "../../../lib/utils/order-status";

export default function SalesListScreen() {
  const {
    orders,
    isLoading,
    isRefetching,
    refetch,
    pending,
    dead,
    goQuickSale,
    goOfflineQueue,
  } = useSalesListScreen();

  return (
    <View style={styles.container}>
      <SellerSalesToolbarFab onQuickSale={goQuickSale} />
      <SellerOfflineQueueBanner pending={pending} dead={dead} onPress={goOfflineQueue} />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma venda ainda.</Text>}
          renderItem={({ item }) => (
            <Link href={`/(tabs)/sales/${item.id}`} asChild>
              <Pressable style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.date}>
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </Text>
                  <Text
                    style={[
                      styles.badge,
                      item.status === "CONFIRMED" && styles.badgeOk,
                      item.status === "CANCELLED" && styles.badgeOff,
                      item.status === "PENDING_CREDIT_APPROVAL" && styles.badgeCredit,
                    ]}
                  >
                    {orderStatusBadgeLabel(item.status)}
                  </Text>
                </View>
                <Text style={styles.customer}>{item.customer?.name ?? "Sem cliente"}</Text>
                <Text style={styles.items}>
                  {item.items.length} item(ns) · R$ {fmtMoney(Number(item.totalAmount))}
                </Text>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  card: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { fontSize: 13, color: "#64748b" },
  badge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  badgeOk: { backgroundColor: "#dcfce7", color: "#166534" },
  badgeOff: { backgroundColor: "#fee2e2", color: "#991b1b" },
  badgeCredit: { backgroundColor: "#fef3c7", color: "#92400e" },
  customer: { marginTop: 8, fontSize: 17, fontWeight: "600", color: "#0f172a" },
  items: { marginTop: 4, fontSize: 14, color: "#64748b" },
  empty: { textAlign: "center", marginTop: 48, color: "#94a3b8" },
});
