import type { ReactNode } from "react";
import { Pressable, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";

type Props = PressableProps & {
  children: ReactNode;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
};

export function ThemedButton({
  children,
  variant = "primary",
  size = "md",
  style,
  disabled,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const padV = size === "sm" ? 8 : size === "lg" ? 14 : 11;
  const padH = size === "sm" ? 12 : size === "lg" ? 20 : 16;

  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "secondary"
        ? colors.surfaceMuted
        : variant === "destructive"
          ? colors.danger
          : "transparent";

  const borderColor =
    variant === "outline" ? colors.border : variant === "ghost" ? "transparent" : bg;

  const textColor =
    variant === "primary" || variant === "destructive"
      ? colors.primaryForeground
      : variant === "secondary"
        ? colors.text
        : variant === "outline"
          ? colors.primary
          : colors.text;

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: variant === "outline" || variant === "ghost" ? "transparent" : bg,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor,
          borderRadius: 12,
          paddingVertical: padV,
          paddingHorizontal: padH,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
      {...rest}
    >
      {typeof children === "string" ? (
        <Text style={{ color: textColor, fontWeight: "600", fontSize: size === "sm" ? 14 : 16 }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
