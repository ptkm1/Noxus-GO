import { ThemedText } from "@/components/atoms/ThemedText";
import { apiBase } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { Server } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

type Props = {
  /** `login` = link no rodapé escuro; `muted` = linha discreta em fundo claro */
  variant?: "login" | "muted";
};

/** Atalho visível para a tela de DevTools (endpoint da API). Só em debug. */
export function DevToolsEntry({ variant = "muted" }: Props) {
  if (!__DEV__) return null;

  const router = useRouter();
  const { colors } = useTheme();
  const isLogin = variant === "login";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir DevTools e configurar endpoint da API"
      onPress={() => router.push("/devtools")}
      style={({ pressed }) => [
        styles.wrap,
        isLogin ? styles.wrapLogin : styles.wrapMuted,
        {
          borderColor: isLogin ? colors.onDarkSubtle : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: isLogin
              ? "rgba(255,255,255,0.12)"
              : colors.surfaceMuted,
          },
        ]}
      >
        <Server
          color={isLogin ? colors.onDarkMuted : colors.primary}
          size={18}
        />
      </View>
      <View style={styles.text}>
        <ThemedText
          variant="bodySm"
          style={{
            fontWeight: "600",
            color: isLogin ? colors.onDarkMuted : colors.text,
          }}
        >
          Configurar servidor
        </ThemedText>
        <ThemedText
          variant="caption"
          numberOfLines={1}
          style={{ color: isLogin ? colors.onDarkSubtle : colors.textMuted }}
        >
          API atual: {apiBase()}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  wrapLogin: {
    marginTop: 16,
  },
  wrapMuted: {
    marginTop: 4,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
