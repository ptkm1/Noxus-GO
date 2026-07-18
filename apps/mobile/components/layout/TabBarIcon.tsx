import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

type Props = {
  Icon: LucideIcon;
  color: string;
  focused: boolean;
};

export function TabBarIcon({ Icon, color, focused }: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        focused && { backgroundColor: colorWithAlpha(colors.primary, 0.12) },
      ]}
    >
      <Icon
        color={focused ? colors.primary : color}
        size={20}
        strokeWidth={1.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 48,
  },
});
