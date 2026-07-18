import { ThemedText } from "@/components/atoms/ThemedText";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";

type Props = {
  isOnline: boolean;
  isSyncing?: boolean;
  lastSync?: Date | null;
  /** Itens sincronizados na última sync bem-sucedida (ex. pedidos da fila). */
  lastSyncedCount?: number | null;
  pendingItems?: number;
};

export function SyncStatusBanner({
  isOnline,
  isSyncing = false,
  lastSync,
  lastSyncedCount = null,
  pendingItems = 0,
}: Props) {
  const { colors } = useTheme();
  const iconBg = isOnline
    ? colorWithAlpha(colors.primary, 0.2)
    : colorWithAlpha(colors.danger, 0.2);

  const timeLabel = lastSync
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(lastSync)
    : null;

  let lastLabel = "Nunca sincronizado";
  if (isSyncing) {
    lastLabel = "A enviar dados…";
  } else if (timeLabel && lastSyncedCount && lastSyncedCount > 0) {
    lastLabel = `Última sync: ${timeLabel} · ${lastSyncedCount} sincronizado${lastSyncedCount === 1 ? "" : "s"}`;
  } else if (timeLabel) {
    lastLabel = `Última sync: ${timeLabel}`;
  }

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
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
        <View
          style={[
            styles.pending,
            { backgroundColor: colorWithAlpha(colors.warning, 0.2) },
          ]}
        >
          <Clock color={colors.warning} size={16} />
          <ThemedText
            variant="caption"
            style={{ color: colors.warning, fontWeight: "600" }}
          >
            {pendingItems} pend.
          </ThemedText>
        </View>
      ) : lastSyncedCount && lastSyncedCount > 0 && lastSync ? (
        <View
          style={[
            styles.pending,
            { backgroundColor: colorWithAlpha(colors.success, 0.2) },
          ]}
        >
          <CheckCircle2 color={colors.success} size={16} />
          <ThemedText
            variant="caption"
            style={{ color: colors.success, fontWeight: "600" }}
          >
            {lastSyncedCount} ok
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
