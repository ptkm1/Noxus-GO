import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedText } from "@/components/atoms/ThemedText";
import type { SellerOrderListItem } from "@/hooks/screens/useSalesListScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import {
  formatRelativeSaleDate,
  formatSaleItemCount,
} from "@pedidos/shared";
import { Link } from "expo-router";
import { MoreVertical, ShoppingCart } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

type Props = {
  orders: SellerOrderListItem[];
  isLoading?: boolean;
  isRefetching?: boolean;
  limit?: number;
};

export function RecentSalesBlock({
  orders,
  isLoading = false,
  isRefetching = false,
  limit = 8,
}: Props) {
  const { colors } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const visible = orders.slice(0, showAll ? orders.length : limit);

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
            onPress={() => setShowAll((v) => !v)}
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
              {showAll ? "Ver menos" : "Ver todas"}
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
          {visible.map((order, index) => {
            const confirmed = order.status === "CONFIRMED";
            const amountColor = confirmed ? colors.success : colors.text;
            return (
              <View key={order.id}>
                {index > 0 ? (
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: colors.border },
                    ]}
                  />
                ) : null}
                <Link href={`/(tabs)/sales/${order.id}`} asChild>
                  <Pressable
                    style={({ pressed }) => [
                      styles.row,
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        {
                          backgroundColor: colorWithAlpha(colors.primary, 0.12),
                          borderColor: colorWithAlpha(colors.primary, 0.2),
                        },
                      ]}
                    >
                      <ShoppingCart color={colors.primary} size={18} />
                    </View>

                    <View style={styles.main}>
                      <ThemedText
                        variant="body"
                        numberOfLines={1}
                        style={{ fontWeight: "600" }}
                      >
                        {order.customer?.name ?? "Sem cliente"}
                      </ThemedText>
                      <ThemedText variant="bodySm" muted numberOfLines={1}>
                        {formatSaleItemCount(order.items.length)}
                      </ThemedText>
                    </View>

                    <ThemedText
                      variant="caption"
                      muted
                      style={styles.date}
                      numberOfLines={1}
                    >
                      {formatRelativeSaleDate(order.createdAt)}
                    </ThemedText>

                    <ThemedText
                      variant="bodySm"
                      style={{
                        fontWeight: "700",
                        color: amountColor,
                        minWidth: 72,
                        textAlign: "right",
                      }}
                    >
                      R$ {fmtMoney(Number(order.totalAmount))}
                    </ThemedText>

                    <MoreVertical
                      color={colors.textMuted}
                      size={18}
                      style={styles.more}
                    />
                  </Pressable>
                </Link>
              </View>
            );
          })}
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
  },
  listOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radiiPx.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  date: {
    maxWidth: 72,
    textAlign: "right",
  },
  more: {
    marginLeft: 2,
  },
});
