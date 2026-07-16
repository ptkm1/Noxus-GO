import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import { LogOut } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemePreferencePicker } from "../components/molecules/ThemePreferencePicker";
import { useSettingsScreen } from "../hooks/screens/useSettingsScreen";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useTheme } from "../lib/theme";
import type { AppColors } from "../lib/theme/types";

export default function SettingsScreen() {
  const styles = useThemedStyles(createSettingsStyles);
  const { colors } = useTheme();
  const { apiUrl, logoutAndGoLogin, logoutPending } = useSettingsScreen();

  return (
    <SafeScreen>
      <MobileHeader title="Configurações" showBack />
      <MobileScreen
        scroll
        noBottomInset
        contentContainerStyle={styles.container}
      >
        <Text style={styles.section}>Aparência</Text>
        <Text style={styles.hint}>
          Escolha o tema do app ou siga o do sistema.
        </Text>
        <ThemePreferencePicker />

        <Text style={styles.section}>API</Text>
        <Text style={styles.hint}>
          URL atual: {apiUrl}
          {"\n\n"}
          Para dispositivo físico ou emulador Android, defina
          EXPO_PUBLIC_API_URL (ex.: IP da sua máquina:4000).
        </Text>
        <Text style={styles.section}>Conta</Text>
        <Pressable
          style={[styles.danger, logoutPending && styles.dangerBusy]}
          disabled={logoutPending}
          onPress={() => void logoutAndGoLogin()}
        >
          <View style={styles.dangerInner}>
            {logoutPending ? (
              <ActivityIndicator color={colors.danger} size="small" />
            ) : (
              <LogOut color={colors.danger} size={20} strokeWidth={2} />
            )}
            <Text style={styles.dangerText}>
              {logoutPending ? "Saindo…" : "Sair"}
            </Text>
          </View>
        </Pressable>
      </MobileScreen>
    </SafeScreen>
  );
}

function createSettingsStyles(c: AppColors) {
  return StyleSheet.create({
    container: { padding: 0, gap: 8 },
    section: {
      marginTop: 16,
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
      textTransform: "uppercase",
    },
    hint: {
      marginTop: 8,
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 22,
    },
    danger: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: c.dangerBorder,
      backgroundColor: c.dangerSurface,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
    },
    dangerBusy: { opacity: 0.6 },
    dangerInner: { flexDirection: "row", alignItems: "center", gap: 10 },
    dangerText: { color: c.danger, fontWeight: "700" },
  });
}
