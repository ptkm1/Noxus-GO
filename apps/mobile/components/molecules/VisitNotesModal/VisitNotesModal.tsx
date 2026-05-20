import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemedTextInput } from "../../atoms/ThemedTextInput";
import { useTheme } from "../../../lib/theme";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  confirmLabel: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (notes: string | undefined) => void;
};

export function VisitNotesModal({
  visible,
  title,
  subtitle,
  confirmLabel,
  pending,
  onClose,
  onConfirm,
}: Props) {
  const { colors } = useTheme();
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (visible) setNotes("");
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
          <ThemedTextInput
            placeholder="Notas (opcional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.input}
            textAlignVertical="top"
          />
          <View style={styles.actions}>
            <Pressable
              style={[styles.btnGhost, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={pending}
            >
              <Text style={[styles.btnGhostTxt, { color: colors.textSecondary }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, { backgroundColor: colors.primary }, pending && styles.btnDis]}
              disabled={pending}
              onPress={() => onConfirm(notes.trim() || undefined)}
            >
              <Text style={[styles.btnPrimaryTxt, { color: colors.primaryForeground }]}>
                {pending ? "…" : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  input: { minHeight: 88, paddingTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  btnGhostTxt: { fontWeight: "600", fontSize: 15 },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnPrimaryTxt: { fontWeight: "700", fontSize: 15 },
  btnDis: { opacity: 0.55 },
});
