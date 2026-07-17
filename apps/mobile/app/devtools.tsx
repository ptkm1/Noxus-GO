import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedText } from "@/components/atoms/ThemedText";
import { ThemedTextInput } from "@/components/atoms/ThemedTextInput";
import { KeyboardForm, MobileHeader, SafeScreen } from "@/components/layout";
import { useDevToolsScreen } from "@/hooks/screens/useDevToolsScreen";
import { useTheme } from "@/lib/theme";
import { radiiPx } from "@pedidos/design-tokens";
import { Platform, Pressable, StyleSheet, View } from "react-native";

export default function DevToolsScreen() {
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
    <SafeScreen>
      <MobileHeader
        title="DevTools"
        subtitle="Endpoint da API neste aparelho"
        showBack
      />
      <KeyboardForm contentContainerStyle={{ gap: 16 }}>
        <View style={[styles.badge, { backgroundColor: colors.warning }]}>
          <ThemedText
            variant="caption"
            style={{ color: colors.primaryForeground, fontWeight: "800" }}
          >
            AMBIENTE DE TESTE
          </ThemedText>
        </View>

        <ThemedText variant="bodySm" muted>
          Informe a URL base do back-end (sem{" "}
          <ThemedText variant="bodySm" style={styles.mono}>
            /api/v1
          </ThemedText>
          ). O valor fica gravado no aparelho até você limpar.
        </ThemedText>
        <ThemedText variant="caption" muted>
          {buildInfo}
        </ThemedText>

        <View>
          <ThemedText variant="label" muted style={{ marginBottom: 8 }}>
            URL base
          </ThemedText>
          <ThemedTextInput
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.10:4000"
            style={{
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            }}
          />
        </View>

        <View style={styles.presetRow}>
          <Pressable
            style={[styles.presetBtn, { borderColor: colors.border }]}
            onPress={() => applyPreset(presets.localhost)}
          >
            <ThemedText variant="bodySm" style={{ fontWeight: "600" }}>
              Emulador
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.presetBtn, { borderColor: colors.border }]}
            onPress={() => applyPreset(presets.lanHint)}
          >
            <ThemedText variant="bodySm" style={{ fontWeight: "600" }}>
              LAN (editar IP)
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.row}>
          <ThemedButton
            style={{ flex: 1 }}
            disabled={saving}
            onPress={() => void saveOverride()}
          >
            {saving ? "Gravando…" : "Gravar e usar"}
          </ThemedButton>
          <ThemedButton
            variant="outline"
            style={{ flex: 1 }}
            disabled={testing}
            onPress={() => void testDraft()}
          >
            {testing ? "Testando…" : "Testar /health"}
          </ThemedButton>
        </View>

        <Pressable onPress={() => void clearOverride()} disabled={saving}>
          <ThemedText
            variant="bodySm"
            style={{ color: colors.textMuted, fontWeight: "600" }}
          >
            Limpar override
          </ThemedText>
        </Pressable>

        {msg ? (
          <ThemedText variant="bodySm" style={{ color: colors.success }}>
            {msg}
          </ThemedText>
        ) : null}
        {testResult ? (
          <ThemedText
            variant="bodySm"
            style={{ color: testResult.ok ? colors.success : colors.danger }}
          >
            {testResult.message}
          </ThemedText>
        ) : null}

        <View
          style={[
            styles.box,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <ThemedText variant="bodySm" style={{ fontWeight: "700" }}>
            Em uso agora
          </ThemedText>
          <ThemedText variant="bodySm" muted>
            Base: {effectiveBase}
          </ThemedText>
          <ThemedText variant="bodySm" muted>
            Exemplo: {sampleApiUrl}
          </ThemedText>
          <ThemedText variant="caption" muted style={{ marginTop: 4 }}>
            Override gravado: {overrideActive ?? "(nenhum — env ou padrão)"}
          </ThemedText>
        </View>

        <ThemedText variant="caption" muted>
          {__DEV__
            ? "Em builds de teste também há atalhos visíveis no login e no perfil."
            : "Em produção: toque 7× rápido no rodapé do app no login ou no perfil para abrir esta tela."}
        </ThemedText>
      </KeyboardForm>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radiiPx.sm,
  },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  presetRow: { flexDirection: "row", gap: 10 },
  presetBtn: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radiiPx.md,
    borderWidth: 1,
    alignItems: "center",
  },
  row: { flexDirection: "row", gap: 10 },
  box: {
    padding: 14,
    borderRadius: radiiPx.lg,
    borderWidth: 1,
    gap: 6,
  },
});
