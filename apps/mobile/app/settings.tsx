import { LogOut } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSettingsScreen } from "../hooks/screens/useSettingsScreen";

export default function SettingsScreen() {
  const { apiUrl, logoutAndGoLogin } = useSettingsScreen();

  return (
    <View style={styles.container}>
      <Text style={styles.section}>API</Text>
      <Text style={styles.hint}>
        URL atual: {apiUrl}
        {"\n\n"}
        Para dispositivo físico ou emulador Android, defina EXPO_PUBLIC_API_URL (ex.: IP da sua máquina:4000).
      </Text>
      <Text style={styles.section}>Conta</Text>
      <Pressable style={styles.danger} onPress={() => void logoutAndGoLogin()}>
        <View style={styles.dangerInner}>
          <LogOut color="#b91c1c" size={20} strokeWidth={2} />
          <Text style={styles.dangerText}>Sair</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 20 },
  section: { marginTop: 16, fontSize: 13, fontWeight: "700", color: "#64748b", textTransform: "uppercase" },
  hint: { marginTop: 8, fontSize: 14, color: "#475569", lineHeight: 22 },
  danger: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  dangerInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  dangerText: { color: "#b91c1c", fontWeight: "700" },
});
