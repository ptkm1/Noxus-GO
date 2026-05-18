import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBarcodeScannerModalStyles } from "./BarcodeScannerModal.styles";

type Props = {
  visible: boolean;
  onClose: () => void;
  onBarcode: (raw: string) => void;
  primaryButtonColor?: string;
};

export function BarcodeScannerModal({ visible, onClose, onBarcode, primaryButtonColor }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useBarcodeScannerModalStyles({
    paddingTop: insets.top,
    primaryButtonColor,
  });
  const [perm, requestPermission] = useCameraPermissions();
  const lastAt = useRef(0);

  useEffect(() => {
    if (visible && perm && !perm.granted) void requestPermission();
  }, [visible, perm, requestPermission]);

  const handleBarcode = useCallback(
    (scanningResult: { data: string }) => {
      const now = Date.now();
      if (now - lastAt.current < 850) return;
      lastAt.current = now;
      onBarcode(scanningResult.data);
    },
    [onBarcode],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeText}>Fechar</Text>
          </Pressable>
          <Text style={styles.title}>Aponte para o código de barras</Text>
          <View style={styles.topSpacer} />
        </View>
        {visible && perm?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            active={visible}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "code128", "upc_a", "code39", "upc_e", "itf14"],
            }}
            onBarcodeScanned={handleBarcode}
          />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackText}>Precisamos da câmara para ler o código do produto.</Text>
            <Pressable style={styles.permBtn} onPress={() => void requestPermission()}>
              <Text style={styles.permBtnText}>Permitir câmara</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
