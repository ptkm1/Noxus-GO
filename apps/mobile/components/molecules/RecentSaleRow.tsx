import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedText } from "@/components/atoms/ThemedText";
import type { SellerOrderListItem } from "@/hooks/screens/useSalesListScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import { formatRelativeSaleDate, formatSaleItemCount } from "@pedidos/shared";
import { Link } from "expo-router";
import { ChevronRight, ShoppingCart } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

const ICON_SIZE = 44;

type Props = {
  order: SellerOrderListItem;
};

export function RecentSaleRow({ order }: Props) {
  const { colors } = useTheme();
  const confirmed = order.status === "CONFIRMED";
  const amountColor = confirmed ? colors.success : colors.text;

  return (
    <Link href={`/(tabs)/vendas/${order.id}`} asChild>
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

export function RecentSaleDivider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
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
  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    alignSelf: "stretch",
  },
});
