import { StyleSheet, View } from "react-native";
import { Clock, RefreshCw, Wifi, WifiOff } from "lucide-react-native";
import { ThemedText } from "@/components/atoms/ThemedText";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";

type Props = {
  isOnline: boolean;
  isSyncing?: boolean;
  lastSync?: Date | null;
  pendingItems?: number;
};

export function SyncStatusBanner({
  isOnline,
  isSyncing = false,
  lastSync,
  pendingItems = 0,
}: Props) {
  const { colors } = useTheme();
  const iconBg = isOnline ? colorWithAlpha(colors.primary, 0.2) : colorWithAlpha(colors.danger, 0.2);

  const lastLabel = lastSync
    ? `Última sync: ${new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(lastSync)}`
    : "Nunca sincronizado";

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        {isSyncing ? (
          <RefreshCw color={colors.primary} size={20} />
        ) : isOnline ? (
          <Wifi color={colors.primary} size={20} />
        ) : (
          <WifiOff color={colors.danger} size={20} />
        )}
      </View>
      <View style={styles.body}>
        <ThemedText variant="body" style={{ fontWeight: "600" }}>
          {isSyncing ? "Sincronizando…" : isOnline ? "Online" : "Offline"}
        </ThemedText>
        <ThemedText variant="bodySm" muted>
          {lastLabel}
        </ThemedText>
      </View>
      {pendingItems > 0 ? (
        <View style={[styles.pending, { backgroundColor: colorWithAlpha(colors.warning, 0.2) }]}>
          <Clock color={colors.warning} size={16} />
          <ThemedText variant="caption" style={{ color: colors.warning, fontWeight: "600" }}>
            {pendingItems} pend.
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radiiPx.lg,
    borderWidth: 1,
    padding: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radiiPx.md,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiiPx.md,
  },
});
