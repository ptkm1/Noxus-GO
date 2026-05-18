import { Pressable, Text } from "react-native";
import { useSellerOfflineQueueBannerStyles } from "./SellerOfflineQueueBanner.styles";

export function SellerOfflineQueueBanner(props: {
  pending: number;
  dead: number;
  onPress: () => void;
  accentBorderColor?: string;
}) {
  const { pending, dead, onPress, accentBorderColor } = props;
  const styles = useSellerOfflineQueueBannerStyles({ accentBorderColor });

  if (pending <= 0 && dead <= 0) return null;

  return (
    <Pressable style={styles.offlineBanner} onPress={onPress}>
      <Text style={styles.offlineBannerTitle}>Fila offline</Text>
      <Text style={styles.offlineBannerTxt}>
        {pending > 0 ? `${pending} pedido(s) por enviar` : "Nenhum por enviar agora"}
        {dead > 0 ? ` · ${dead} precisam revisão` : ""}
      </Text>
      <Text style={styles.offlineBannerHint}>Toque para gerir · envio automático com rede</Text>
    </Pressable>
  );
}
