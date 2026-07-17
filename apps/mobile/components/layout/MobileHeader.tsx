import { ThemedText } from "@/components/atoms/ThemedText";
import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
};

export function MobileHeader({
  title,
  subtitle,
  showBack,
  onBack,
  leftAction,
  rightAction,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 12,
          backgroundColor: colors.headerBackground,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          {leftAction ? (
            <View style={styles.side}>{leftAction}</View>
          ) : showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={handleBack}
              style={[styles.backBtn, { backgroundColor: colors.surfaceMuted }]}
            >
              <ChevronLeft color={colors.text} size={22} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText variant="title" numberOfLines={1}>
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText variant="caption" muted style={{ marginTop: 2 }}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
        </View>
        {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  right: {
    flexShrink: 0,
  },
  side: {
    flexShrink: 0,
  },
});
