import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  badge?: number;
};

export function HeaderIconButton({ children, onPress, badge }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.btn, { backgroundColor: colors.surfaceMuted }]}
      accessibilityRole="button"
    >
      {children}
      {badge != null && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryForeground, fontSize: 10, fontWeight: "700" }}>
            {badge > 9 ? "9+" : badge}
          </Text>
        </View>
      ) : null}
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
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
