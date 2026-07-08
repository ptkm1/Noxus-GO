import { Redirect } from "expo-router";
import { ShoppingBag } from "lucide-react-native";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemedTextInput } from "../components/atoms/ThemedTextInput";
import { DevToolsEntry } from "../components/molecules/DevToolsEntry";
import { DevToolsVersionTap } from "../components/molecules/DevToolsVersionTap";
import { useLoginScreen } from "../hooks/screens/useLoginScreen";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../lib/theme";
import type { AppColors } from "../lib/theme/types";

export default function LoginScreen() {
  const styles = useThemedStyles(createLoginStyles);
  const { colors } = useTheme();
  const {
    email,
    setEmail,
    password,
    setPassword,
    err,
    pending,
    shouldRedirectSeller,
    onSubmit,
  } = useLoginScreen();

  if (shouldRedirectSeller) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.wrap}
    >
      <View style={styles.inner}>
        <View style={styles.card}>
          <View style={styles.brand}>
            <ShoppingBag color={colors.primary} size={36} strokeWidth={2} />
            <Text style={styles.title}>Pedidos</Text>
          </View>
          <Text style={styles.sub}>Acesso vendedor</Text>
          <ThemedTextInput
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <ThemedTextInput
            placeholder="Senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <Pressable
            style={[styles.btn, pending && styles.btnDisabled]}
            onPress={() => void onSubmit()}
            disabled={pending}
          >
            {pending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.btnText}>Entrar</Text>
            )}
          </Pressable>
        </View>
        <DevToolsEntry variant="login" />
        <DevToolsVersionTap variant="onDark" />
      </View>
    </KeyboardAvoidingView>
  );
}

function createLoginStyles(c: AppColors) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: c.loginHero },
    inner: { flex: 1, justifyContent: "center", padding: 24 },
    card: {
      backgroundColor: c.loginCard,
      borderRadius: 16,
      padding: 24,
      gap: 12,
    },
    brand: { flexDirection: "row", alignItems: "center", gap: 12 },
    title: { fontSize: 24, fontWeight: "700", color: c.text },
    sub: { fontSize: 14, color: c.textSecondary, marginBottom: 8 },
    err: { color: c.danger, fontSize: 14 },
    btn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: c.primaryForeground, fontWeight: "600", fontSize: 16 },
  });
}
