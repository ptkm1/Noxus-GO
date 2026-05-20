import { MapPinOff } from "lucide-react-native";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../lib/theme";
import type { MapUnavailableReason } from "../../lib/maps/google-maps-config";

type Props = {
  style?: StyleProp<ViewStyle>;
  reason: MapUnavailableReason;
};

const COPY: Record<MapUnavailableReason, { title: string; body: string }> = {
  expo_go: {
    title: "Mapa não funciona no Expo Go",
    body: "O mapa Google só existe no app instalado (build EAS / APK). No Expo Go podes testar lista, check-in e navegação (Maps/Waze). Para ver o mapa embutido: pnpm build:mobile:android",
  },
  not_configured: {
    title: "Mapa indisponível",
    body: "Este build não tem chave do Google Maps. Defina EXPO_PUBLIC_GOOGLE_MAPS_API_KEY no .env, atualize o app.config e gere um novo build.",
  },
  load_failed: {
    title: "Falha ao carregar o mapa",
    body: "Não foi possível abrir o mapa. Verifique a chave do Google Maps ou tente novamente mais tarde.",
  },
};

export function RoutePlanMapUnavailable({ style, reason }: Props) {
  const { colors } = useTheme();
  const copy = COPY[reason];

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <MapPinOff color={colors.iconMuted} size={36} strokeWidth={2} />
      <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{copy.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 10,
    overflow: "hidden",
  },
  title: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 13, lineHeight: 19, textAlign: "center" },
});
