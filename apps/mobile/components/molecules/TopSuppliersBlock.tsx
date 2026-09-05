import { displayMoney } from "@/components/atoms/formatMoney";
import { ThemedText } from "@/components/atoms/ThemedText";
import { ThemedTextInput } from "@/components/atoms/ThemedTextInput";
import { useSalesBySupplier } from "@/hooks/screens/useSalesBySupplier";
import { PERIOD_PRESET_LABELS, type PeriodPreset } from "@/lib/period-presets";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BarChart, ruleTypes } from "react-native-gifted-charts";

const PRESETS: PeriodPreset[] = [
  "this_month",
  "last_month",
  "last_7_days",
  "last_90_days",
];

const CHART_HEIGHT = 180;

type SupplierBar = {
  value: number;
  label: string;
  fullName: string;
  frontColor: string;
};

type Props = {
  hideValues?: boolean;
};

function formatDateInput(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}

function parseDateInput(value: string, endOfDay = false): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    ),
  );
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return date.toISOString();
}

function shortSupplierName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 11) return trimmed;
  const firstWord = trimmed.split(/\s+/)[0] ?? trimmed;
  return firstWord.length <= 11 ? firstWord : `${firstWord.slice(0, 10)}…`;
}

function formatYAxisValue(value: string, hideValues: boolean): string {
  if (hideValues) return "••••";
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return number >= 1000 ? `${(number / 1000).toFixed(1)}k` : String(Math.round(number));
}

export function TopSuppliersBlock({ hideValues = false }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const {
    preset,
    selectPreset,
    setCustomRange,
    isCustomRange,
    data,
    isLoading,
    isFetching,
    error,
  } = useSalesBySupplier();
  const [customOpen, setCustomOpen] = useState(false);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  const barData = useMemo<SupplierBar[]>(() => {
    if (!data?.topSuppliers.length) return [];
    return data.topSuppliers.map((s) => ({
      value: Math.round(s.totalAmount * 100) / 100,
      label: shortSupplierName(s.tradeName),
      fullName: s.tradeName,
      frontColor: colors.primary,
    }));
  }, [colors.primary, data?.topSuppliers]);
  const chartWidth = width - 32 - 28;
  const barWidth = Math.max(18, Math.min(40, (chartWidth - 24) / Math.max(barData.length, 1) - 12));

  const openCustomRange = () => {
    setDateError(null);
    setFromInput(data ? formatDateInput(data.period.from) : "");
    setToInput(data ? formatDateInput(data.period.to) : "");
    setCustomOpen((open) => !open);
  };

  const applyCustomRange = () => {
    const from = parseDateInput(fromInput);
    const to = parseDateInput(toInput, true);
    if (!from || !to) {
      setDateError("Use o formato DD/MM/AAAA.");
      return;
    }
    if (new Date(from) > new Date(to)) {
      setDateError("A data inicial deve ser anterior à final.");
      return;
    }
    setDateError(null);
    setCustomRange({ from, to });
    setCustomOpen(false);
  };

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
          ? ` · ${displayMoney(hideValues, data.totals.totalAmount)} em ${data.totals.orderCount} pedido(s)`
          : ""}
      </ThemedText>

      <View style={styles.chips}>
        {PRESETS.map((p) => {
          const active = preset === p;
          return (
            <Pressable
              key={p}
              onPress={() => selectPreset(p)}
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
        <Pressable
          onPress={openCustomRange}
          style={[
            styles.chip,
            {
              backgroundColor: isCustomRange ? colors.chipActive : colors.chip,
              borderColor: isCustomRange ? colors.primary : colors.border,
            },
          ]}
        >
          <ThemedText
            variant="caption"
            style={{
              fontWeight: "600",
              color: isCustomRange ? colors.chipTextActive : colors.chipText,
            }}
          >
            Personalizado
          </ThemedText>
        </Pressable>
      </View>

      {customOpen ? (
        <View style={[styles.customRange, { borderColor: colors.border }]}>
          <View style={styles.customFields}>
            <View style={styles.dateField}>
              <Text style={[styles.dateLabel, { color: colors.textMuted }]}>De</Text>
              <ThemedTextInput
                value={fromInput}
                onChangeText={setFromInput}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={[styles.dateLabel, { color: colors.textMuted }]}>Até</Text>
              <ThemedTextInput
                value={toInput}
                onChangeText={setToInput}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>
          {dateError ? (
            <ThemedText variant="caption" style={{ color: colors.danger }}>
              {dateError}
            </ThemedText>
          ) : null}
          <Pressable
            style={[styles.applyRangeButton, { backgroundColor: colors.primary }]}
            onPress={applyCustomRange}
          >
            <ThemedText variant="caption" style={{ color: colors.primaryForeground, fontWeight: "700" }}>
              Aplicar período
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

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
            barWidth={barWidth}
            spacing={10}
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
            xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9, width: 54, textAlign: "center" }}
            labelsExtraHeight={30}
            focusBarOnPress
            renderTooltip={(item: SupplierBar) => (
              <View style={[styles.tooltip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ThemedText variant="caption" style={{ fontWeight: "600" }}>{item.fullName}</ThemedText>
                <ThemedText variant="caption" muted style={{ marginTop: 2 }}>{displayMoney(hideValues, item.value)}</ThemedText>
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
  customRange: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  customFields: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1, gap: 5 },
  dateLabel: { fontSize: 12, fontWeight: "700" },
  applyRangeButton: { alignSelf: "flex-end", borderRadius: radiiPx.md, paddingHorizontal: 12, paddingVertical: 9 },
  tooltip: { borderWidth: 1, borderRadius: radiiPx.md, paddingHorizontal: 10, paddingVertical: 8, maxWidth: 180 },
});
