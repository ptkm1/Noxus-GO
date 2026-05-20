import { LogOut } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemePreferencePicker } from "../components/molecules/ThemePreferencePicker";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useSettingsScreen } from "../hooks/screens/useSettingsScreen";
import { useTheme } from "../lib/theme";
import type { AppColors } from "../lib/theme/types";

export default function SettingsScreen() {
  const styles = useThemedStyles(createSettingsStyles);
  const { colors } = useTheme();
  const { apiUrl, logoutAndGoLogin } = useSettingsScreen();

  return (
    <View style={styles.container}>
      <Text style={styles.section}>Aparência</Text>
      <Text style={styles.hint}>Escolha o tema do app ou siga o do sistema.</Text>
      <ThemePreferencePicker />

      <Text style={styles.section}>API</Text>
      <Text style={styles.hint}>
        URL atual: {apiUrl}
        {"\n\n"}
        Para dispositivo físico ou emulador Android, defina EXPO_PUBLIC_API_URL (ex.: IP da sua máquina:4000).
      </Text>
      <Text style={styles.section}>Conta</Text>
      <Pressable style={styles.danger} onPress={() => void logoutAndGoLogin()}>
        <View style={styles.dangerInner}>
          <LogOut color={colors.danger} size={20} strokeWidth={2} />
          <Text style={styles.dangerText}>Sair</Text>
        </View>
      </Pressable>
    </View>
  );
}

function createSettingsStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 20 },
    section: {
      marginTop: 16,
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
      textTransform: "uppercase",
    },
    hint: { marginTop: 8, fontSize: 14, color: c.textSecondary, lineHeight: 22 },
    danger: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: c.dangerBorder,
      backgroundColor: c.dangerSurface,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
    },
    dangerInner: { flexDirection: "row", alignItems: "center", gap: 10 },
    dangerText: { color: c.danger, fontWeight: "700" },
  });
}
