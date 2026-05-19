import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ShoppingBag } from "lucide-react-native";
import { Redirect } from "expo-router";
import { useLoginScreen } from "../hooks/screens/useLoginScreen";
import { useSecretDevToolsGesture } from "../lib/devtools/secret-gesture";

export default function LoginScreen() {
  const { email, setEmail, password, setPassword, err, pending, shouldRedirectSeller, onSubmit } =
    useLoginScreen();
  const { onSecretPress } = useSecretDevToolsGesture();

  if (shouldRedirectSeller) {
    return <Redirect href="/(tabs)/sales" />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.wrap}
    >
      <View style={styles.card}>
        <Pressable style={styles.brand} onPress={onSecretPress} accessibilityRole="button">
          <ShoppingBag color="#0284c7" size={36} strokeWidth={2} />
          <Text style={styles.title}>Pedidos</Text>
        </Pressable>
        <Text style={styles.sub}>Acesso vendedor</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
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
          {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Entrar</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0c4a6e" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  sub: { fontSize: 14, color: "#64748b", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  err: { color: "#dc2626", fontSize: 14 },
  btn: {
    backgroundColor: "#0284c7",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
