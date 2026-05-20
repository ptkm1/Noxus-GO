import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemedTextInput } from "../components/atoms/ThemedTextInput";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { useDevToolsScreen } from "../hooks/screens/useDevToolsScreen";
import { useTheme } from "../lib/theme";
import type { AppColors } from "../lib/theme/types";

export default function DevToolsScreen() {
  const styles = useThemedStyles(createDevToolsStyles);
  const { colors } = useTheme();
  const {
    draft,
    setDraft,
    overrideActive,
    effectiveBase,
    sampleApiUrl,
    buildInfo,
    testing,
    testResult,
    saving,
    msg,
    saveOverride,
    clearOverride,
    testDraft,
    applyPreset,
    presets,
  } = useDevToolsScreen();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.badge}>DevTools</Text>
      <Text style={styles.lead}>
        Define a URL base do back-end (sem <Text style={styles.mono}>/api/v1</Text>). Grava no aparelho — útil em
        builds de teste antes de publicar.
      </Text>
      <Text style={styles.meta}>{buildInfo}</Text>

      <Text style={styles.label}>URL base</Text>
      <ThemedTextInput
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://192.168.1.10:4000"
      />

      <View style={styles.presetRow}>
        <Pressable style={styles.presetBtn} onPress={() => applyPreset(presets.localhost)}>
          <Text style={styles.presetTxt}>Emulador</Text>
        </Pressable>
        <Pressable style={styles.presetBtn} onPress={() => applyPreset(presets.lanHint)}>
          <Text style={styles.presetTxt}>LAN (editar IP)</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnPrimary, saving && styles.btnOff]}
          disabled={saving}
          onPress={() => void saveOverride()}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.btnPrimaryTxt}>Gravar e usar</Text>
          )}
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => void testDraft()} disabled={testing}>
          {testing ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.btnGhostTxt}>Testar /health</Text>
          )}
        </Pressable>
      </View>

      <Pressable style={styles.linkBtn} onPress={() => void clearOverride()} disabled={saving}>
        <Text style={styles.linkTxt}>Limpar override</Text>
      </Pressable>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      {testResult ? (
        <Text style={[styles.testResult, testResult.ok ? styles.testOk : styles.testErr]}>{testResult.message}</Text>
      ) : null}

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Em uso agora</Text>
        <Text style={styles.boxLine}>Base: {effectiveBase}</Text>
        <Text style={styles.boxLine}>Exemplo: {sampleApiUrl}</Text>
        <Text style={styles.boxMuted}>
          Override gravado: {overrideActive ?? "(nenhum — env ou padrão)"}
        </Text>
      </View>

      <Text style={styles.hint}>
        Acesso secreto: toque 7× rápido no rodapé «Pedidos v…» no login ou no Perfil.
      </Text>
    </ScrollView>
  );
}

function createDevToolsStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, paddingBottom: 40 },
    badge: {
      alignSelf: "flex-start",
      backgroundColor: c.warning,
      color: c.primaryForeground,
      fontWeight: "800",
      fontSize: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      overflow: "hidden",
    },
    lead: { marginTop: 12, fontSize: 14, color: c.textSecondary, lineHeight: 20 },
    mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13 },
    meta: { marginTop: 8, fontSize: 12, color: c.textMuted },
    label: {
      marginTop: 20,
      fontSize: 12,
      fontWeight: "700",
      color: c.textMuted,
      textTransform: "uppercase",
    },
    presetRow: { flexDirection: "row", gap: 10, marginTop: 10 },
    presetBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    presetTxt: { color: c.text, fontSize: 13, fontWeight: "600" },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
    btn: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10,
      minWidth: 120,
      alignItems: "center",
    },
    btnPrimary: { backgroundColor: c.primary },
    btnPrimaryTxt: { color: c.primaryForeground, fontWeight: "700" },
    btnGhost: { borderWidth: 1, borderColor: c.primary },
    btnGhostTxt: { color: c.primary, fontWeight: "700" },
    btnOff: { opacity: 0.6 },
    linkBtn: { marginTop: 12, alignSelf: "flex-start" },
    linkTxt: { color: c.textMuted, fontWeight: "600", fontSize: 14 },
    msg: { marginTop: 14, color: c.success, fontSize: 13 },
    testResult: { marginTop: 10, fontSize: 13 },
    testOk: { color: c.success },
    testErr: { color: c.danger },
    box: {
      marginTop: 24,
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      gap: 6,
    },
    boxTitle: { fontWeight: "800", color: c.text, marginBottom: 4 },
    boxLine: { fontSize: 13, color: c.textSecondary },
    boxMuted: { marginTop: 6, fontSize: 12, color: c.textMuted },
    hint: { marginTop: 20, fontSize: 12, color: c.textMuted, lineHeight: 18 },
  });
}
