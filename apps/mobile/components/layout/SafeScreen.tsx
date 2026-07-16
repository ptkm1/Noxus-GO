import { useTheme } from "@/lib/theme";
import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export type SafeScreenVariant = "stack" | "tab" | "topOnly";

type Props = {
  children: ReactNode;
  /**
   * - `stack`: todas as bordas (telas fora da tab bar)
   * - `tab`: topo + laterais (a tab bar já cobre o fundo)
   * - `topOnly`: só topo (ex. mapas / footers absolutos que tratam o bottom)
   */
  variant?: SafeScreenVariant;
  /** Sobrescreve `variant` se precisar de controlo fino. */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
};

const VARIANT_EDGES: Record<SafeScreenVariant, readonly Edge[]> = {
  stack: ["top", "right", "bottom", "left"],
  tab: ["top", "right", "left"],
  topOnly: ["top", "right", "left"],
};

/**
 * Contentor de ecrã com safe area (status bar, notch, botões nativos Android).
 * Usar como raiz de cada ecrã; o `MobileHeader` já não aplica inset de topo.
 */
export function SafeScreen({
  children,
  variant = "stack",
  edges,
  style,
  backgroundColor,
}: Props) {
  const { colors } = useTheme();
  const resolvedEdges = edges ?? VARIANT_EDGES[variant];

  return (
    <SafeAreaView
      edges={resolvedEdges}
      style={[
        styles.fill,
        { backgroundColor: backgroundColor ?? colors.background },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
