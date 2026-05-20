import { Settings } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedTextInput } from "../../components/atoms/ThemedTextInput";
import { DevToolsVersionTap } from "../../components/molecules/DevToolsVersionTap";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { useProfileScreen } from "../../hooks/screens/useProfileScreen";
import { useTheme } from "../../lib/theme";
import type { AppColors } from "../../lib/theme/types";

export default function ProfileScreen() {
  const styles = useThemedStyles(createProfileStyles);
  const { colors } = useTheme();
  const { me, name, setName, saveName, goSettings } = useProfileScreen();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Nome</Text>
        <ThemedTextInput value={name} onChangeText={setName} />
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
          <Settings color={colors.primary} size={20} strokeWidth={2} />
          <Text style={styles.secondaryText}>Configurações</Text>
        </View>
      </Pressable>
      <DevToolsVersionTap />
    </View>
  );
}

function createProfileStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      gap: 4,
    },
    label: { marginTop: 12, fontSize: 12, fontWeight: "600", color: c.textSecondary },
    static: { marginTop: 4, fontSize: 16, color: c.text },
    btn: {
      marginTop: 20,
      backgroundColor: c.primary,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    btnText: { color: c.primaryForeground, fontWeight: "600" },
    secondary: { marginTop: 16, padding: 14, alignItems: "center" },
    secondaryInner: { flexDirection: "row", alignItems: "center", gap: 10 },
    secondaryText: { color: c.primary, fontWeight: "600", fontSize: 16 },
  });
}
