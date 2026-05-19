import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useDevToolsScreen } from "../hooks/screens/useDevToolsScreen";

export default function DevToolsScreen() {
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
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://192.168.1.10:4000"
        placeholderTextColor="#94a3b8"
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
        <Pressable style={[styles.btn, styles.btnPrimary, saving && styles.btnOff]} disabled={saving} onPress={() => void saveOverride()}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryTxt}>Gravar e usar</Text>}
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => void testDraft()} disabled={testing}>
          {testing ? <ActivityIndicator color="#0369a1" /> : <Text style={styles.btnGhostTxt}>Testar /health</Text>}
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
        Acesso secreto: toque 7× rápido no título «Pedidos» no login, ou 7× na versão no Perfil.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 20, paddingBottom: 40 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#f59e0b",
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  lead: { marginTop: 12, fontSize: 14, color: "#cbd5e1", lineHeight: 20 },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13 },
  meta: { marginTop: 8, fontSize: 12, color: "#64748b" },
  label: { marginTop: 20, fontSize: 12, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#f8fafc",
    backgroundColor: "#1e293b",
  },
  presetRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#475569",
  },
  presetTxt: { color: "#e2e8f0", fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 120,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: "#0284c7" },
  btnPrimaryTxt: { color: "#fff", fontWeight: "700" },
  btnGhost: { borderWidth: 1, borderColor: "#38bdf8" },
  btnGhostTxt: { color: "#38bdf8", fontWeight: "700" },
  btnOff: { opacity: 0.6 },
  linkBtn: { marginTop: 12, alignSelf: "flex-start" },
  linkTxt: { color: "#94a3b8", fontWeight: "600", fontSize: 14 },
  msg: { marginTop: 14, color: "#86efac", fontSize: 13 },
  testResult: { marginTop: 10, fontSize: 13 },
  testOk: { color: "#86efac" },
  testErr: { color: "#fca5a5" },
  box: {
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    gap: 6,
  },
  boxTitle: { fontWeight: "800", color: "#f8fafc", marginBottom: 4 },
  boxLine: { fontSize: 13, color: "#e2e8f0" },
  boxMuted: { marginTop: 6, fontSize: 12, color: "#94a3b8" },
  hint: { marginTop: 20, fontSize: 12, color: "#64748b", lineHeight: 18 },
});
