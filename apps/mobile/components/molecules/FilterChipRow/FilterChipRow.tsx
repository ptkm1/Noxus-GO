import { Pressable, ScrollView, StyleSheet } from "react-native";
import { ThemedText } from "@/components/atoms/ThemedText";
import { useTheme } from "@/lib/theme";
import { radiiPx } from "@pedidos/design-tokens";

export type ChipOption<T extends string = string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (id: T) => void;
};

export function FilterChipRow<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.chipActive : colors.chip,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <ThemedText
              variant="bodySm"
              style={{
                fontWeight: "600",
                color: active ? colors.chipTextActive : colors.chipText,
              }}
            >
              {opt.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
});
