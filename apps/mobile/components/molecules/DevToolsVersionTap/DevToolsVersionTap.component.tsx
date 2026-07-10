import { APP_BRAND_NAME } from "@pedidos/shared";
import Constants from "expo-constants";
import { Pressable, Text } from "react-native";
import { apiBase } from "../../../lib/api";
import { useSecretDevToolsGesture } from "../../../lib/devtools/secret-gesture";
import {
  useDevToolsVersionTapStyles,
  type DevToolsVersionTapVariant,
} from "./DevToolsVersionTap.styles";

type Props = {
  variant?: DevToolsVersionTapVariant;
};

export function DevToolsVersionTap({ variant = "default" }: Props) {
  const styles = useDevToolsVersionTapStyles(variant);
  const { onSecretPress } = useSecretDevToolsGesture();
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <Pressable
      style={styles.wrap}
      onPress={onSecretPress}
      accessibilityRole="button"
    >
      <Text style={styles.version}>
        {APP_BRAND_NAME} v{version}
      </Text>
      <Text style={styles.api} numberOfLines={2}>
        API · {apiBase()}
      </Text>
    </Pressable>
  );
}
