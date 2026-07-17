import { ThemedText } from "@/components/atoms/ThemedText";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import type { LucideIcon } from "lucide-react-native";
import { TrendingDown, TrendingUp } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

type Props = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; label?: string };
  onPress?: () => void;
  style?: object;
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  onPress,
  style,
}: Props) {
  const { colors } = useTheme();
  const isPositive = trend ? trend.value >= 0 : true;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: onPress && pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.body}>
          <ThemedText variant="bodySm" muted>
            {title}
          </ThemedText>
          <ThemedText
            variant="display"
            style={{ marginTop: 8, fontSize: 28, lineHeight: 32 }}
          >
            {value}
          </ThemedText>
          {subtitle ? (
            <ThemedText variant="bodySm" muted style={{ marginTop: 4 }}>
              {subtitle}
            </ThemedText>
          ) : null}
          {trend ? (
            <View style={styles.trendRow}>
              {isPositive ? (
                <TrendingUp color={colors.primary} size={14} />
              ) : (
                <TrendingDown color={colors.danger} size={14} />
              )}
              <ThemedText
                variant="bodySm"
                style={{
                  color: isPositive ? colors.primary : colors.danger,
                  fontWeight: "600",
                }}
              >
                {isPositive ? "+" : ""}
                {trend.value}%
              </ThemedText>
              {trend.label ? (
                <ThemedText variant="caption" muted>
                  {trend.label}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </View>
        {Icon ? (
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: colorWithAlpha(colors.primary, 0.12) },
            ]}
          >
            <Icon color={colors.primary} size={16} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

type ProgressProps = {
  title: string;
  current: number;
  target: number;
  formatValue?: (v: number) => string;
};

export function ProgressStat({
  title,
  current,
  target,
  formatValue = (v) => String(v),
}: ProgressProps) {
  const { colors } = useTheme();
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.progressHead}>
        <ThemedText variant="bodySm" muted>
          {title}
        </ThemedText>
        <ThemedText
          variant="bodySm"
          style={{ color: colors.primary, fontWeight: "600" }}
        >
          {pct.toFixed(1)}%
        </ThemedText>
      </View>
      <View style={{ marginTop: 12 }}>
        <View style={styles.progressValues}>
          <ThemedText variant="titleSm">{formatValue(current)}</ThemedText>
          <ThemedText variant="bodySm" muted>
            de {formatValue(target)}
          </ThemedText>
        </View>
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View
            style={[
              styles.fill,
              { width: `${pct}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radiiPx.lg,
    borderWidth: 1,
    padding: 16,
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  body: { flex: 1, minWidth: 0 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: radiiPx.md,
    alignItems: "center",
    justifyContent: "center",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  progressHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressValues: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});
