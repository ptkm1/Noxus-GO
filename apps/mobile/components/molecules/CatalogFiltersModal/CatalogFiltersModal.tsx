import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedText } from "@/components/atoms/ThemedText";
import { useTheme } from "@/lib/theme";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCategoryFilterBarStyles } from "../../organisms/CategoryFilterBar/CategoryFilterBar.styles";

type CategoryChip = { id: string; name: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  categories: CategoryChip[];
  selectedCategoryId: string | null;
  onApply: (categoryId: string | null) => void;
};

export function CatalogFiltersModal({
  visible,
  onClose,
  categories,
  selectedCategoryId,
  onApply,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const chipStyles = useCategoryFilterBarStyles();
  const [draft, setDraft] = useState<string | null>(selectedCategoryId);

  useEffect(() => {
    if (visible) setDraft(selectedCategoryId);
  }, [visible, selectedCategoryId]);

  function apply() {
    onApply(draft);
    onClose();
  }

  function clear() {
    setDraft(null);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.header}>
            <ThemedText variant="titleSm">Filtros</ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Fechar"
            >
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {categories.length === 0 ? (
            <ThemedText variant="bodySm" muted style={styles.empty}>
              Nenhuma categoria disponível.
            </ThemedText>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              <ThemedText variant="caption" muted style={styles.sectionLabel}>
                Categorias
              </ThemedText>
              <View style={styles.chipsWrap}>
                <Pressable
                  onPress={() => setDraft(null)}
                  style={[
                    chipStyles.chip,
                    draft === null && chipStyles.chipOn,
                    styles.chipBlock,
                  ]}
                >
                  <ThemedText
                    variant="bodySm"
                    style={
                      draft === null ? chipStyles.chipTxtOn : chipStyles.chipTxt
                    }
                  >
                    Todas
                  </ThemedText>
                </Pressable>
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setDraft(c.id)}
                    style={[
                      chipStyles.chip,
                      draft === c.id && chipStyles.chipOn,
                      styles.chipBlock,
                    ]}
                  >
                    <ThemedText
                      variant="bodySm"
                      numberOfLines={1}
                      style={
                        draft === c.id
                          ? chipStyles.chipTxtOn
                          : chipStyles.chipTxt
                      }
                    >
                      {c.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          <View style={styles.actions}>
            <ThemedButton
              variant="secondary"
              style={styles.flex}
              onPress={clear}
            >
              Limpar
            </ThemedButton>
            <ThemedButton style={styles.flex} onPress={apply}>
              Aplicar
            </ThemedButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  backdropTap: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    maxHeight: "70%",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 8 },
  sectionLabel: { marginBottom: 10 },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipBlock: { marginRight: 0, marginBottom: 0 },
  empty: { paddingVertical: 24, textAlign: "center" },
  actions: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
});
