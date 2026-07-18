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
  singleLine: {
    overflow: "hidden",
  },
});

export function ThemedTextInput({
  style,
  placeholderTextColor,
  invalid,
  multiline,
  numberOfLines,
  ...props
}: TextInputProps & { invalid?: boolean }) {
  const { colors } = useTheme();
  const isMultiline = multiline === true;

  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? colors.placeholder}
      multiline={isMultiline}
      numberOfLines={isMultiline ? numberOfLines : 1}
      style={[
        base.field,
        !isMultiline && base.singleLine,
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
