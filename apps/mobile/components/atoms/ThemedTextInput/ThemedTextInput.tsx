import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { useTheme } from "../../../lib/theme";

const base = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
});

export function ThemedTextInput({
  style,
  placeholderTextColor,
  invalid,
  ...props
}: TextInputProps & { invalid?: boolean }) {
  const { colors } = useTheme();

  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? colors.placeholder}
      style={[
        base.field,
        {
          color: colors.inputText,
          backgroundColor: colors.inputBackground,
          borderColor: invalid ? colors.danger : colors.inputBorder,
        },
        style,
      ]}
      {...props}
    />
  );
}
