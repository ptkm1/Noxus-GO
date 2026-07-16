import { useTheme } from "@/lib/theme";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = {
  children: ReactNode;
  /** Botões / ações fora do scroll — ficam acima do teclado. */
  footer?: ReactNode;
  /** Extra offset when há header nativo/custom acima do form. */
  offset?: number;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  style?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Padding inferior do scroll (além do spacer do teclado). */
  bottomPadding?: number;
};

/**
 * Formulário com área scrollável + footer fixo (fora do scroll).
 * O safe area inferior fica no SafeScreen; o footer só tem padding compacto.
 */
export function KeyboardForm({
  children,
  footer,
  offset = 0,
  contentContainerStyle,
  style,
  refreshing,
  onRefresh,
  bottomPadding = 24,
}: Props) {
  const { colors } = useTheme();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const keyboardOpen = keyboardHeight > 0;

  const scrollKbPad = keyboardOpen
    ? Platform.OS === "android"
      ? Math.max(keyboardHeight - 48, 120)
      : Math.max(keyboardHeight * 0.25, 80)
    : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.fill, style]}
      behavior="padding"
      keyboardVerticalOffset={offset}
    >
      <ScrollView
        style={[styles.fill, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.content,
          footer ? styles.contentWithFooter : null,
          { paddingBottom: bottomPadding + scrollKbPad },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>

      {footer ? (
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.card,
              paddingBottom: 8,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 20,
  },
  contentWithFooter: {
    flexGrow: 0,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
});
