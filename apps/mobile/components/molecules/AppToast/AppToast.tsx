import { useTheme } from "@/lib/theme";
import { radiiPx } from "@pedidos/design-tokens";
import {
  AlertCircle,
  CheckCircle2,
  TriangleAlert,
  X,
} from "lucide-react-native";
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

export type AppToastTone = "success" | "warning" | "danger";

type Props = {
  visible: boolean;
  message: string;
  tone?: AppToastTone;
  onDismiss?: () => void;
  /** Offset from bottom (e.g. footer height). */
  bottomOffset?: number;
  style?: ViewStyle;
};

export function AppToast({
  visible,
  message,
  tone = "warning",
  onDismiss,
  bottomOffset = 24,
  style,
}: Props) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!visible || !message) {
      opacity.setValue(0);
      translateY.setValue(12);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, message, opacity, translateY]);

  if (!visible || !message) return null;

  const accent =
    tone === "success"
      ? colors.success
      : tone === "danger"
        ? colors.danger
        : colors.warning;
  /** Fundos sólidos (sem alpha) para contraste legível sobre qualquer conteúdo. */
  const surface =
    tone === "warning"
      ? colors.warningSurface
      : tone === "danger"
        ? colors.dangerSurface
        : colors.card;
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "danger"
        ? AlertCircle
        : TriangleAlert;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.host,
        { bottom: bottomOffset, opacity, transform: [{ translateY }] },
        style,
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: surface,
            borderColor: accent,
          },
        ]}
      >
        <View
          style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}
        >
          <Icon color={accent} size={20} strokeWidth={2.2} />
        </View>
        <Text
          style={[styles.message, { color: colors.text }]}
          numberOfLines={3}
        >
          {message}
        </Text>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            accessibilityLabel="Fechar aviso"
            style={styles.dismiss}
          >
            <X color={colors.textSecondary} size={18} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radiiPx.lg,
    borderWidth: 1.5,
    elevation: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radiiPx.md,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  dismiss: {
    padding: 2,
  },
});
