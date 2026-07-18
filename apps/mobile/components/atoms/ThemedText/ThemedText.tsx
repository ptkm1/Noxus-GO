import { useTheme } from "@/lib/theme";
import { typography } from "@pedidos/design-tokens";
import { Text, type TextProps } from "react-native";

type Variant =
  | "display"
  | "title"
  | "titleSm"
  | "body"
  | "bodySm"
  | "caption"
  | "label";

type Props = TextProps & {
  variant?: Variant;
  muted?: boolean;
  color?: string;
};

export function ThemedText({
  variant = "body",
  muted,
  color,
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const t = typography[variant];
  return (
    <Text
      style={[
        {
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          fontWeight: t.fontWeight,
          color: color ?? (muted ? colors.textMuted : colors.text),
        },
        style,
      ]}
      {...rest}
    />
  );
}
