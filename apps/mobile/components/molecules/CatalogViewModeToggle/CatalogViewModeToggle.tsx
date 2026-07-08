import type { CatalogViewMode } from "@/hooks/useCatalogViewMode";
import { useTheme } from "@/lib/theme";
import { LayoutGrid, List } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";

type Props = {
  viewMode: CatalogViewMode;
  onToggle: () => void;
};

export function CatalogViewModeToggle({ viewMode, onToggle }: Props) {
  const { colors } = useTheme();
  const Icon = viewMode === "grid" ? List : LayoutGrid;
  const label = viewMode === "grid" ? "Lista" : "Grade";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Alternar para visualização em ${label.toLowerCase()}`}
      onPress={onToggle}
      style={[styles.btn, { backgroundColor: colors.surfaceMuted }]}
    >
      <Icon size={20} color={colors.primary} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
