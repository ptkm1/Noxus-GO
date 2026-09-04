import { ThemedText } from "@/components/atoms/ThemedText";
import {
  RecentSaleDivider,
  RecentSaleRow,
} from "@/components/molecules/RecentSaleRow";
import type { SellerOrderListItem } from "@/hooks/screens/useSalesListScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

type Props = {
  orders: SellerOrderListItem[];
  isLoading?: boolean;
  isRefetching?: boolean;
  limit?: number;
  hideValues?: boolean;
};

export function RecentSalesBlock({
  orders,
  isLoading = false,
  isRefetching = false,
  limit = 5,
  hideValues = false,
}: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const visible = orders.slice(0, limit);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText variant="titleSm">Vendas recentes</ThemedText>
          <ThemedText variant="bodySm" muted style={{ marginTop: 4 }}>
            Suas últimas vendas confirmadas.
          </ThemedText>
        </View>
        {orders.length > limit ? (
          <Pressable
            onPress={() => router.push("/(tabs)/vendas")}
            style={({ pressed }) => [
              styles.viewAllPill,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <ThemedText variant="caption" style={{ fontWeight: "600" }}>
              Ver todas
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginVertical: 20 }}
        />
      ) : visible.length === 0 ? (
        <ThemedText
          variant="bodySm"
          muted
          style={{ textAlign: "center", paddingVertical: 24 }}
        >
          Nenhuma venda ainda.
        </ThemedText>
      ) : (
        <View style={[styles.list, { borderTopColor: colors.border }]}>
          {visible.map((order, index) => (
            <View key={order.id}>
              {index > 0 ? <RecentSaleDivider color={colors.border} /> : null}
              <RecentSaleRow order={order} hideValues={hideValues} />
            </View>
          ))}
          {isRefetching ? (
            <View
              style={[
                styles.listOverlay,
                { backgroundColor: colorWithAlpha(colors.background, 0.55) },
              ]}
            >
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radiiPx.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  viewAllPill: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  list: {
    borderTopWidth: 1,
    position: "relative",
    paddingVertical: 8,
  },
  listOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
