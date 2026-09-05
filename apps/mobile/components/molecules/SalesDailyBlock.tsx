import { displayMoney } from "@/components/atoms/formatMoney";
import { ThemedText } from "@/components/atoms/ThemedText";
import type { SellerOrderListItem } from "@/hooks/screens/useSalesListScreen";
import { PERIOD_PRESET_LABELS, periodRange, type PeriodPreset } from "@/lib/period-presets";
import { useTheme } from "@/lib/theme";
import { radiiPx } from "@pedidos/design-tokens";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { BarChart, ruleTypes } from "react-native-gifted-charts";

const PRESETS: PeriodPreset[] = ["this_month", "last_month", "last_7_days", "last_90_days"];
const CHART_HEIGHT = 210;

type Props = {
  orders: SellerOrderListItem[];
  hideValues?: boolean;
};

type DailyBar = { value: number; label: string; fullLabel: string; frontColor: string };

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatYAxisValue(value: string, hideValues: boolean): string {
  if (hideValues) return "••••";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function SalesDailyBlock({ orders, hideValues = false }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const range = useMemo(() => periodRange(preset), [preset]);
  const chartWidth = width - 32 - 28;

  const { bars, total, orderCount } = useMemo(() => {
    const from = new Date(range.from);
    const to = new Date(range.to);
    const amounts = new Map<string, number>();
    let totalAmount = 0;
    let confirmedOrders = 0;

    for (const order of orders) {
      if (order.status !== "CONFIRMED") continue;
      const createdAt = new Date(order.createdAt);
      if (createdAt < from || createdAt > to) continue;
      const amount = Number(order.totalAmount);
      if (!Number.isFinite(amount)) continue;
      const key = dayKey(createdAt);
      amounts.set(key, (amounts.get(key) ?? 0) + amount);
      totalAmount += amount;
      confirmedOrders += 1;
    }

    const allDays: DailyBar[] = [];
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    const numberOfDays = Math.max(1, Math.round((last.getTime() - cursor.getTime()) / 86_400_000) + 1);
    const labelEvery = numberOfDays > 31 ? 14 : numberOfDays > 14 ? 3 : 1;
    let index = 0;
    while (cursor <= last) {
      const key = dayKey(cursor);
      const fullLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(cursor);
      allDays.push({
        value: Math.round((amounts.get(key) ?? 0) * 100) / 100,
        label: index % labelEvery === 0 ? fullLabel.replace(".", "") : "",
        fullLabel,
        frontColor: colors.primary,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      index += 1;
    }
    return { bars: allDays, total: totalAmount, orderCount: confirmedOrders };
  }, [colors.primary, orders, range.from, range.to]);

  const barWidth = Math.max(4, Math.min(24, (chartWidth - 24) / Math.max(bars.length, 1) - 3));

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <ThemedText variant="titleSm">Vendas por dia</ThemedText>
      <ThemedText variant="bodySm" muted style={{ marginTop: 4 }}>
        {displayMoney(hideValues, total)} em {orderCount} pedido{orderCount === 1 ? "" : "s"}
      </ThemedText>
      <View style={styles.chips}>
        {PRESETS.map((item) => {
          const active = item === preset;
          return (
            <Pressable
              key={item}
              onPress={() => setPreset(item)}
              style={[styles.chip, { backgroundColor: active ? colors.chipActive : colors.chip, borderColor: active ? colors.primary : colors.border }]}
            >
              <ThemedText variant="caption" style={{ fontWeight: "600", color: active ? colors.chipTextActive : colors.chipText }}>
                {PERIOD_PRESET_LABELS[item]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {bars.some((bar) => bar.value > 0) ? (
        <View style={styles.chartWrap}>
          <BarChart
            data={bars}
            width={chartWidth}
            height={CHART_HEIGHT}
            adjustToWidth
            parentWidth={chartWidth}
            barWidth={barWidth}
            spacing={3}
            initialSpacing={12}
            endSpacing={12}
            noOfSections={4}
            roundedTop
            barBorderRadius={3}
            yAxisColor={colors.border}
            xAxisColor={colors.border}
            rulesColor={colors.border}
            rulesType={ruleTypes.DASHED}
            dashWidth={3}
            dashGap={3}
            xAxisThickness={1}
            yAxisThickness={0}
            formatYLabel={(value) => formatYAxisValue(value, hideValues)}
            yAxisTextStyle={{ color: colors.textMuted, fontSize: 11 }}
            xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9, width: 48, textAlign: "center" }}
            labelsExtraHeight={18}
            focusBarOnPress
            renderTooltip={(item: DailyBar) => (
              <View style={[styles.tooltip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ThemedText variant="caption" style={{ fontWeight: "600" }}>{item.fullLabel}</ThemedText>
                <ThemedText variant="caption" muted style={{ marginTop: 2 }}>{displayMoney(hideValues, item.value)}</ThemedText>
              </View>
            )}
          />
        </View>
      ) : (
        <ThemedText variant="bodySm" muted style={{ marginTop: 16 }}>Sem vendas confirmadas no período.</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radiiPx.lg, borderWidth: 1, padding: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: radiiPx.md, paddingHorizontal: 10, paddingVertical: 6 },
  chartWrap: { marginTop: 8, overflow: "hidden" },
  tooltip: { borderWidth: 1, borderRadius: radiiPx.md, paddingHorizontal: 10, paddingVertical: 8 },
});
