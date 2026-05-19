import Constants from "expo-constants";
import { Settings } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useProfileScreen } from "../../hooks/screens/useProfileScreen";
import { useSecretDevToolsGesture } from "../../lib/devtools/secret-gesture";
import { apiBase } from "../../lib/api";

export default function ProfileScreen() {
  const { me, name, setName, saveName, goSettings } = useProfileScreen();
  const { onSecretPress } = useSecretDevToolsGesture();
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Nome</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.label}>Email</Text>
        <Text style={styles.static}>{me?.email}</Text>
        {me?.commissionPercent != null ? (
          <>
            <Text style={styles.label}>Comissão</Text>
            <Text style={styles.static}>{me.commissionPercent}%</Text>
          </>
        ) : null}
        <Pressable style={styles.btn} onPress={saveName}>
          <Text style={styles.btnText}>Salvar nome</Text>
        </Pressable>
      </View>
      <Pressable style={styles.secondary} onPress={goSettings}>
        <View style={styles.secondaryInner}>
          <Settings color="#0284c7" size={20} strokeWidth={2} />
          <Text style={styles.secondaryText}>Configurações</Text>
        </View>
      </Pressable>
      <Pressable style={styles.versionTap} onPress={onSecretPress}>
        <Text style={styles.versionText}>Pedidos v{version}</Text>
        <Text style={styles.versionApi} numberOfLines={1}>
          API · {apiBase()}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  label: { marginTop: 12, fontSize: 12, fontWeight: "600", color: "#64748b" },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  static: { marginTop: 4, fontSize: 16, color: "#0f172a" },
  btn: {
    marginTop: 20,
    backgroundColor: "#0284c7",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  secondary: { marginTop: 16, padding: 14, alignItems: "center" },
  secondaryInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  secondaryText: { color: "#0284c7", fontWeight: "600", fontSize: 16 },
  versionTap: { marginTop: 28, alignItems: "center", padding: 12 },
  versionText: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  versionApi: { marginTop: 4, fontSize: 11, color: "#cbd5e1", maxWidth: "100%" },
});
