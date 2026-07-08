import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedText } from "@/components/atoms/ThemedText";
import type { SellerOrderListItem } from "@/hooks/screens/useSalesListScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import { formatRelativeSaleDate, formatSaleItemCount } from "@pedidos/shared";
import { Link } from "expo-router";
import { ChevronRight, ShoppingCart } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

type Props = {
  orders: SellerOrderListItem[];
  isLoading?: boolean;
  isRefetching?: boolean;
  limit?: number;
};

type RowProps = {
  order: SellerOrderListItem;
};

function RecentSaleRow({ order }: RowProps) {
  const { colors } = useTheme();
  const confirmed = order.status === "CONFIRMED";
  const amountColor = confirmed ? colors.success : colors.text;

  return (
    <Link href={`/(tabs)/sales/${order.id}`} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.pressable,
          { opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={styles.itemRow}>
          <View
            style={[
              styles.iconCell,
              {
                backgroundColor: colorWithAlpha(colors.primary, 0.12),
                borderColor: colorWithAlpha(colors.primary, 0.2),
              },
            ]}
          >
            <ShoppingCart color={colors.primary} size={18} />
          </View>

          <View style={styles.infoCell}>
            <View style={styles.infoLine}>
              <ThemedText
                variant="body"
                numberOfLines={1}
                style={styles.customer}
              >
                {order.customer?.name ?? "Sem cliente"}
              </ThemedText>
              <ThemedText
                variant="bodySm"
                numberOfLines={1}
                style={[styles.amount, { color: amountColor }]}
              >
                R$ {fmtMoney(Number(order.totalAmount))}
              </ThemedText>
            </View>

            <View style={styles.infoLine}>
              <ThemedText
                variant="bodySm"
                muted
                numberOfLines={1}
                style={styles.meta}
              >
                {formatSaleItemCount(order.items.length)} ·{" "}
                {formatRelativeSaleDate(order.createdAt)}
              </ThemedText>
              <ChevronRight color={colors.textMuted} size={16} />
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

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
          {visible.map((order, index) => (
            <View key={order.id}>
              {index > 0 ? (
                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />
              ) : null}
              <RecentSaleRow order={order} />
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

const ICON_SIZE = 44;

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
    gap: 8,
    paddingVertical: 8,
  },
  listOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    alignSelf: "stretch",
  },
  pressable: {
    width: "100%",
  },
  itemRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconCell: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radiiPx.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginRight: 12,
  },
  infoCell: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  infoLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customer: {
    flex: 1,
    minWidth: 0,
    fontWeight: "600",
  },
  amount: {
    flexShrink: 0,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
});
