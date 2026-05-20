import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import type { ThemePreference } from "../../../lib/theme/types";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

export function ThemePreferencePicker() {
  const { preference, setPreference, colors } = useTheme();

  return (
    <View style={styles.wrap}>
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.chip,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setPreference(opt.value)}
          >
            <Text style={[styles.chipTxt, { color: active ? colors.chipTextActive : colors.chipText }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 14, fontWeight: "600" },
});
