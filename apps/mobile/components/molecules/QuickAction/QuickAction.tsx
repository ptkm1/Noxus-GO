import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { ThemedText } from "@/components/atoms/ThemedText";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";

type Variant = "default" | "primary" | "warning";

type QuickActionProps = {
  icon: LucideIcon;
  label: string;
  description?: string;
  onPress?: () => void;
  badge?: string | number;
  variant?: Variant;
};

export function QuickAction({
  icon: Icon,
  label,
  description,
  onPress,
  badge,
  variant = "default",
}: QuickActionProps) {
  const { colors } = useTheme();
  const borderColor =
    variant === "primary"
      ? colorWithAlpha(colors.primary, 0.3)
      : variant === "warning"
        ? colorWithAlpha(colors.warning, 0.3)
        : colors.border;
  const bg =
    variant === "primary"
      ? colorWithAlpha(colors.primary, 0.06)
      : variant === "warning"
        ? colorWithAlpha(colors.warning, 0.06)
        : colors.card;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        {
          backgroundColor: bg,
          borderColor,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor:
              variant === "primary"
                ? colorWithAlpha(colors.primary, 0.2)
                : variant === "warning"
                  ? colorWithAlpha(colors.warning, 0.2)
                  : colors.surfaceMuted,
          },
        ]}
      >
        <Icon
          color={
            variant === "primary"
              ? colors.primary
              : variant === "warning"
                ? colors.warning
                : colors.text
          }
          size={24}
        />
      </View>
      <View style={styles.text}>
        <ThemedText variant="body" style={{ fontWeight: "600" }} numberOfLines={1}>
          {label}
        </ThemedText>
        {description ? (
          <ThemedText variant="bodySm" muted numberOfLines={1}>
            {description}
          </ThemedText>
        ) : null}
      </View>
      {badge !== undefined ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor:
                variant === "primary" ? colors.primary : colors.surfaceMuted,
            },
          ]}
        >
          <ThemedText
            variant="caption"
            style={{
              fontWeight: "700",
              color: variant === "primary" ? colors.primaryForeground : colors.text,
            }}
          >
            {badge}
          </ThemedText>
        </View>
      ) : null}
      <ChevronRight color={colors.iconMuted} size={20} />
    </Pressable>
  );
}

type ClienteCardProps = {
  nome: string;
  endereco: string;
  ultimaCompra?: string;
  inadimplente?: boolean;
  favorito?: boolean;
  curvaABC?: "A" | "B" | "C";
  onPress?: () => void;
};

export function ClienteCard({
  nome,
  endereco,
  ultimaCompra,
  inadimplente,
  favorito,
  curvaABC,
  onPress,
}: ClienteCardProps) {
  const { colors } = useTheme();
  const initial = nome.charAt(0).toUpperCase();
  const avatarBg =
    curvaABC === "A"
      ? colorWithAlpha(colors.primary, 0.2)
      : curvaABC === "B"
        ? colorWithAlpha(colors.primary, 0.1)
        : colors.surfaceMuted;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        {
          backgroundColor: colors.card,
          borderColor: inadimplente ? colorWithAlpha(colors.danger, 0.35) : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <ThemedText variant="titleSm" style={{ color: colors.primary, fontWeight: "700" }}>
          {initial}
        </ThemedText>
      </View>
      <View style={styles.text}>
        <ThemedText variant="body" style={{ fontWeight: "600" }} numberOfLines={1}>
          {nome}
          {favorito ? " ★" : ""}
          {inadimplente ? " ⚠" : ""}
        </ThemedText>
        <ThemedText variant="bodySm" muted numberOfLines={1}>
          {endereco}
        </ThemedText>
        {ultimaCompra ? (
          <ThemedText variant="caption" muted style={{ marginTop: 4 }}>
            Última compra: {ultimaCompra}
          </ThemedText>
        ) : null}
      </View>
      {curvaABC ? (
        <View style={[styles.abcBadge, { backgroundColor: avatarBg }]}>
          <ThemedText variant="caption" style={{ fontWeight: "700", color: colors.primary }}>
            {curvaABC}
          </ThemedText>
        </View>
      ) : null}
      <ChevronRight color={colors.iconMuted} size={20} />
    </Pressable>
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radiiPx.md,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, minWidth: 0 },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radiiPx.md,
    alignItems: "center",
    justifyContent: "center",
  },
  abcBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
