import { fmtMoney } from "@/components/atoms/formatMoney";
import { ThemedText } from "@/components/atoms/ThemedText";
import { useSalesBySupplier } from "@/hooks/screens/useSalesBySupplier";
import { PERIOD_PRESET_LABELS, type PeriodPreset } from "@/lib/period-presets";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { BarChart, ruleTypes } from "react-native-gifted-charts";

const PRESETS: PeriodPreset[] = [
  "this_month",
  "last_month",
  "last_7_days",
  "last_90_days",
];

const CHART_HEIGHT = 220;

type SupplierBar = {
  value: number;
  label: string;
  fullName: string;
  frontColor: string;
};

function truncateLabel(name: string, max = 14): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function formatYAxisValue(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function TopSuppliersBlock() {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { preset, setPreset, data, isLoading, isFetching, error } =
    useSalesBySupplier();

  const chartWidth = windowWidth - 32 - 28;

  const barData = useMemo<SupplierBar[]>(() => {
    if (!data?.topSuppliers.length) return [];
    return data.topSuppliers.map((s) => ({
      value: Math.round(s.totalAmount * 100) / 100,
      label: truncateLabel(s.tradeName),
      fullName: s.tradeName,
      frontColor: colors.primary,
    }));
  }, [colors.primary, data?.topSuppliers]);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <ThemedText variant="titleSm">Top fornecedores</ThemedText>
      <ThemedText variant="bodySm" muted style={{ marginTop: 4 }}>
        Suas vendas confirmadas por indústria
        {data
          ? ` · R$ ${fmtMoney(data.totals.totalAmount)} em ${data.totals.orderCount} pedido(s)`
          : ""}
      </ThemedText>

      <View style={styles.chips}>
        {PRESETS.map((p) => {
          const active = preset === p;
          return (
            <Pressable
              key={p}
              onPress={() => setPreset(p)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.chipActive : colors.chip,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <ThemedText
                variant="caption"
                style={{
                  fontWeight: "600",
                  color: active ? colors.chipTextActive : colors.chipText,
                }}
              >
                {PERIOD_PRESET_LABELS[p]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.chartLoading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <ThemedText
          variant="bodySm"
          style={{ marginTop: 12, color: colors.danger }}
        >
          {(error as Error).message}
        </ThemedText>
      ) : !barData.length ? (
        <ThemedText variant="bodySm" muted style={{ marginTop: 12 }}>
          Sem vendas com fornecedor no período.
        </ThemedText>
      ) : (
        <View style={styles.chartWrap}>
          <BarChart
            data={barData}
            width={chartWidth}
            height={CHART_HEIGHT}
            adjustToWidth
            parentWidth={chartWidth}
            barWidth={28}
            initialSpacing={12}
            endSpacing={12}
            noOfSections={4}
            roundedTop
            roundedBottom={false}
            barBorderRadius={4}
            frontColor={colors.primary}
            yAxisColor={colors.border}
            xAxisColor={colors.border}
            rulesColor={colors.border}
            rulesType={ruleTypes.DASHED}
            dashWidth={3}
            dashGap={3}
            xAxisThickness={1}
            yAxisThickness={0}
            formatYLabel={formatYAxisValue}
            yAxisTextStyle={{ color: colors.textMuted, fontSize: 11 }}
            xAxisLabelTextStyle={{
              color: colors.textMuted,
              fontSize: 10,
              width: 52,
              textAlign: "center",
            }}
            labelsExtraHeight={18}
            focusBarOnPress
            renderTooltip={(item: SupplierBar) => (
              <View
                style={[
                  styles.tooltip,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  style={{ fontWeight: "600" }}
                  numberOfLines={2}
                >
                  {item.fullName}
                </ThemedText>
                <ThemedText variant="caption" muted style={{ marginTop: 2 }}>
                  R$ {fmtMoney(item.value)}
                </ThemedText>
              </View>
            )}
          />
          {isFetching && !isLoading ? (
            <View
              style={[
                styles.chartOverlay,
                { backgroundColor: colorWithAlpha(colors.background, 0.65) },
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
    padding: 14,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radiiPx.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chartWrap: {
    marginTop: 8,
    overflow: "hidden",
    position: "relative",
  },
  chartLoading: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    minHeight: CHART_HEIGHT,
  },
  chartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  tooltip: {
    borderWidth: 1,
    borderRadius: radiiPx.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 200,
  },
});
