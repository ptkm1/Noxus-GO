import { ThemedButton } from "@/components/atoms/ThemedButton";
import { ThemedCard } from "@/components/atoms/ThemedCard";
import { ThemedText } from "@/components/atoms/ThemedText";
import { MobileHeader, MobileScreen, SafeScreen } from "@/components/layout";
import {
    useReportsScreen,
    type ReportKind,
} from "@/hooks/screens/useReportsScreen";
import { useTheme } from "@/lib/theme";
import { colorWithAlpha } from "@/lib/theme/colorAlpha";
import { radiiPx } from "@pedidos/design-tokens";
import { FileText, Share2, Users } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

const KIND_ORDER: ReportKind[] = [
  "sales-summary",
  "sales-by-customer",
  "sales-by-supplier",
];

export default function ReportsScreen() {
  const { colors } = useTheme();
  const s = useReportsScreen();

  return (
    <SafeScreen variant="tab">
      <MobileHeader title="Relatórios" subtitle={s.scopeLabel} showBack />
      <MobileScreen contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
        <ThemedText variant="bodySm" muted>
          Gere PDFs das suas vendas confirmadas e compartilhe pelo celular.
        </ThemedText>

        <ThemedCard>
          <ThemedText variant="titleSm" style={{ marginBottom: 10 }}>
            Período
          </ThemedText>
          <View style={styles.chips}>
            {s.presets.map((p) => {
              const active = s.preset === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => s.setPreset(p)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active
                        ? colorWithAlpha(colors.primary, 0.12)
                        : colors.surfaceMuted,
                    },
                  ]}
                >
                  <ThemedText
                    variant="caption"
                    style={{
                      fontWeight: "600",
                      color: active ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {s.periodLabels[p]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ThemedCard>

        {s.isTeamLeader ? (
          <ThemedCard>
            <ThemedText variant="titleSm" style={{ marginBottom: 10 }}>
              Escopo
            </ThemedText>
            <View style={styles.scopeRow}>
              <Pressable
                onPress={() => s.setScope("own")}
                style={[
                  styles.scopeBtn,
                  {
                    borderColor:
                      s.scope === "own" ? colors.primary : colors.border,
                    backgroundColor:
                      s.scope === "own"
                        ? colorWithAlpha(colors.primary, 0.12)
                        : colors.card,
                  },
                ]}
              >
                <FileText
                  size={18}
                  color={s.scope === "own" ? colors.primary : colors.iconMuted}
                />
                <ThemedText
                  variant="bodySm"
                  style={{
                    fontWeight: "600",
                    color: s.scope === "own" ? colors.primary : colors.text,
                  }}
                >
                  Só minhas vendas
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => s.setScope("team")}
                style={[
                  styles.scopeBtn,
                  {
                    borderColor:
                      s.scope === "team" ? colors.primary : colors.border,
                    backgroundColor:
                      s.scope === "team"
                        ? colorWithAlpha(colors.primary, 0.12)
                        : colors.card,
                  },
                ]}
              >
                <Users
                  size={18}
                  color={s.scope === "team" ? colors.primary : colors.iconMuted}
                />
                <ThemedText
                  variant="bodySm"
                  style={{
                    fontWeight: "600",
                    color: s.scope === "team" ? colors.primary : colors.text,
                  }}
                >
                  Equipe toda
                </ThemedText>
              </Pressable>
            </View>
          </ThemedCard>
        ) : null}

        {s.isAdmin ? (
          <ThemedCard>
            <ThemedText variant="bodySm" muted>
              Como administrador, os PDFs incluem todas as vendas confirmadas da
              organização no período.
            </ThemedText>
          </ThemedCard>
        ) : null}

        {KIND_ORDER.map((kind) => {
          const meta = s.reports[kind];
          const pending = s.pendingKind === kind;
          return (
            <ThemedCard key={kind}>
              <ThemedText variant="titleSm">{meta.title}</ThemedText>
              <ThemedText
                variant="bodySm"
                muted
                style={{ marginTop: 4, marginBottom: 14 }}
              >
                {meta.description}
              </ThemedText>
              <ThemedButton
                size="lg"
                loading={pending}
                loadingLabel="Gerando…"
                disabled={s.pendingKind != null}
                onPress={() => void s.generate(kind)}
              >
                <View style={styles.btnInner}>
                  <Share2 color={colors.primaryForeground} size={18} />
                  <ThemedText
                    variant="body"
                    style={{
                      color: colors.primaryForeground,
                      fontWeight: "700",
                    }}
                  >
                    Gerar e compartilhar PDF
                  </ThemedText>
                </View>
              </ThemedButton>
            </ThemedCard>
          );
        })}

        {s.err ? (
          <ThemedText style={{ color: colors.danger, textAlign: "center" }}>
            {s.err}
          </ThemedText>
        ) : null}
      </MobileScreen>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scopeRow: { gap: 10 },
  scopeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radiiPx.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
