import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Offset quando o header fica fora deste contentor. */
  offset?: number;
};

/**
 * Wrapper fino para ecrãs/modais que já têm o próprio ScrollView/FlatList
 * (ex. venda rápida, login com layout custom).
 */
export function KeyboardAvoidingScreen({ children, style, offset = 0 }: Props) {
  const behavior = Platform.OS === "ios" ? "padding" : "padding";
  const keyboardVerticalOffset =
    Platform.OS === "ios" ? offset : Math.max(offset, 0);

  return (
    <KeyboardAvoidingView
      style={[styles.fill, style]}
      behavior={behavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
