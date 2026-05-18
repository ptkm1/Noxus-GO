import { Text, type TextProps } from "react-native";
import { fmtMoney } from "../../atoms/formatMoney";
import { useMoneyLabelStyles, type MoneyLabelStylesParams } from "./MoneyLabel.styles";

export function MoneyLabel(
  props: { amount: number } & MoneyLabelStylesParams & TextProps,
) {
  const { amount, color, fontSize, fontWeight, style, ...rest } = props;
  const styles = useMoneyLabelStyles({ color, fontSize, fontWeight });

  return (
    <Text style={[styles.text, style]} {...rest}>
      R$ {fmtMoney(amount)}
    </Text>
  );
}
