import { KeyboardAvoidingScreen, SafeScreen } from "@/components/layout";
import { APP_BRAND_TAGLINE } from "@pedidos/shared";
import { Redirect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemedTextInput } from "../components/atoms/ThemedTextInput";
import { CommerceProWordmark } from "../components/brand/CommerceProBrand";
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
    <SafeScreen backgroundColor={colors.loginHero}>
      <KeyboardAvoidingScreen>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.brand}>
              <CommerceProWordmark iconSize={44} />
            </View>
            <Text style={styles.tagline}>{APP_BRAND_TAGLINE}</Text>
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
        </ScrollView>
      </KeyboardAvoidingScreen>
    </SafeScreen>
  );
}

function createLoginStyles(c: AppColors) {
  return StyleSheet.create({
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
      gap: 16,
    },
    card: {
      backgroundColor: c.loginCard,
      borderRadius: 16,
      padding: 24,
      gap: 12,
    },
    brand: { alignItems: "flex-start" },
    tagline: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.6,
      color: c.primary,
      marginBottom: 4,
    },
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
