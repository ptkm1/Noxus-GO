import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { useTheme } from "@/lib/theme";
import { radiiPx } from "@pedidos/design-tokens";
import { AlertCircle, AlertTriangle, Info } from "lucide-react-native";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
} from "react-native";
import type {
  ConfirmDialogMode,
  ConfirmTone,
  ChooseOption,
} from "./types";

type Props = {
  visible: boolean;
  mode: ConfirmDialogMode;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
  options?: ChooseOption[];
  onConfirm: () => void;
  onCancel: () => void;
  onChoose: (id: string) => void;
};

function toneIcon(tone: ConfirmTone) {
  if (tone === "destructive") return AlertTriangle;
  if (tone === "danger") return AlertCircle;
  return Info;
}

export function ConfirmModal({
  visible,
  mode,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone,
  options,
  onConfirm,
  onCancel,
  onChoose,
}: Props) {
  const { colors } = useTheme();
  const Icon = toneIcon(tone);
  const iconColor =
    tone === "destructive" || tone === "danger"
      ? colors.danger
      : colors.primary;
  const iconBg =
    tone === "destructive" || tone === "danger"
      ? colors.dangerSurface
      : colors.surfaceMuted;

  const a11yRole: AccessibilityRole =
    mode === "alert" ? "alert" : "none";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      navigationBarTranslucent
      accessibilityViewIsModal
    >
      <View style={styles.overlay} accessibilityRole={a11yRole}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel="Fechar"
          accessibilityRole="button"
        />
        <ThemedCard style={styles.card} padded>
          <View style={styles.header}>
            <View
              style={[styles.iconWrap, { backgroundColor: iconBg }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icon color={iconColor} size={22} strokeWidth={2.2} />
            </View>
            <View style={styles.copy}>
              <ThemedText variant="titleSm" style={styles.title}>
                {title}
              </ThemedText>
              {description ? (
                <ThemedText variant="bodySm" muted style={styles.description}>
                  {description}
                </ThemedText>
              ) : null}
            </View>
          </View>

          {mode === "choose" ? (
            <View style={styles.chooseList}>
              {(options ?? []).map((opt) => (
                <ThemedButton
                  key={opt.id}
                  variant={
                    opt.tone === "destructive" || opt.tone === "danger"
                      ? "destructive"
                      : "outline"
                  }
                  disabled={opt.disabled}
                  onPress={() => onChoose(opt.id)}
                  accessibilityState={{ disabled: Boolean(opt.disabled) }}
                >
                  {opt.label}
                </ThemedButton>
              ))}
              <ThemedButton variant="ghost" onPress={onCancel}>
                {cancelLabel}
              </ThemedButton>
            </View>
          ) : (
            <View style={styles.actions}>
              {mode === "confirm" ? (
                <ThemedButton
                  variant="outline"
                  style={styles.actionBtn}
                  onPress={onCancel}
                >
                  {cancelLabel}
                </ThemedButton>
              ) : null}
              <ThemedButton
                variant={
                  tone === "destructive" || tone === "danger"
                    ? "destructive"
                    : "primary"
                }
                style={styles.actionBtn}
                onPress={onConfirm}
              >
                {confirmLabel}
              </ThemedButton>
            </View>
          )}
        </ThemedCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  card: {
    zIndex: 1,
    gap: 16,
    borderRadius: radiiPx["2xl"],
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radiiPx.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 6,
    paddingTop: 2,
  },
  title: {
    fontWeight: "700",
  },
  description: {
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
  },
  chooseList: {
    gap: 8,
  },
});
