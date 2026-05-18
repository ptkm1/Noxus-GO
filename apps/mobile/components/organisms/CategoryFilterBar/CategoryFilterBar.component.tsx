import { Pressable, ScrollView, Text, View } from "react-native";
import { useCategoryFilterBarStyles } from "./CategoryFilterBar.styles";

type CategoryChip = { id: string; name: string };

export function CategoryFilterBar(props: {
  categories: CategoryChip[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  chipActiveBackgroundColor?: string;
}) {
  const { categories, selectedCategoryId, onSelectCategory, chipActiveBackgroundColor } = props;
  const styles = useCategoryFilterBarStyles({ chipActiveBackgroundColor });

  if (categories.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Categorias</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Pressable
          onPress={() => onSelectCategory(null)}
          style={[styles.chip, selectedCategoryId === null && styles.chipOn]}
        >
          <Text style={[styles.chipTxt, selectedCategoryId === null && styles.chipTxtOn]}>Todas</Text>
        </Pressable>
        {categories.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => onSelectCategory(c.id)}
            style={[styles.chip, selectedCategoryId === c.id && styles.chipOn]}
          >
            <Text
              style={[styles.chipTxt, selectedCategoryId === c.id && styles.chipTxtOn]}
              numberOfLines={1}
            >
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
