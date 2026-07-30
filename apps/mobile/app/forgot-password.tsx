import { KeyboardAvoidingScreen, SafeScreen } from "@/components/layout";
import { useRouter } from "expo-router";
import { useState } from "react";
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
import { useThemedStyles } from "../hooks/useThemedStyles";
import { apiFetch } from "../lib/api";
import { useTheme } from "../lib/theme";
import type { AppColors } from "../lib/theme/types";

export default function ForgotPasswordScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setErr(null);
    setPending(true);
    try {
      await apiFetch<{ ok?: boolean }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        skipAuth: true,
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao solicitar reset");
    } finally {
      setPending(false);
    }
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
            <Text style={styles.title}>Esqueci minha senha</Text>
            <Text style={styles.sub}>
              {done
                ? "Se existir uma conta ativa com este e-mail, enviaremos um link. Abra o e-mail no celular e use o link para redefinir a senha no navegador."
                : "Informe o e-mail da sua conta. Enviaremos instruções se a conta estiver ativa."}
            </Text>
            {done ? (
              <Pressable
                style={styles.btn}
                onPress={() => router.replace("/login")}
              >
                <Text style={styles.btnText}>Voltar ao login</Text>
              </Pressable>
            ) : (
              <>
                <ThemedTextInput
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
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
                    <Text style={styles.btnText}>Enviar link</Text>
                  )}
                </Pressable>
                <Pressable onPress={() => router.back()}>
                  <Text style={styles.link}>Voltar</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingScreen>
    </SafeScreen>
  );
}

function createStyles(c: AppColors) {
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
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: c.text,
      marginTop: 4,
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
    link: {
      textAlign: "center",
      color: c.primary,
      fontWeight: "600",
      fontSize: 14,
      marginTop: 8,
    },
  });
}
