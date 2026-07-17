import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBarcodeScannerModalStyles } from "./BarcodeScannerModal.styles";

type Props = {
  visible: boolean;
  onClose: () => void;
  onBarcode: (raw: string) => void;
  primaryButtonColor?: string;
};

export function BarcodeScannerModal({
  visible,
  onClose,
  onBarcode,
  primaryButtonColor,
}: Props) {
  const insets = useSafeAreaInsets();
  const styles = useBarcodeScannerModalStyles({
    paddingTop: insets.top,
    primaryButtonColor,
  });
  const [perm, requestPermission] = useCameraPermissions();
  const lastAt = useRef(0);
  const [locked, setLocked] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [permRequesting, setPermRequesting] = useState(false);

  useEffect(() => {
    if (visible && perm && !perm.granted) {
      setPermRequesting(true);
      void requestPermission().finally(() => setPermRequesting(false));
    }
  }, [visible, perm, requestPermission]);

  useEffect(() => {
    if (visible) {
      setLocked(false);
      setStatusLine(null);
      lastAt.current = 0;
    }
  }, [visible]);

  const handleBarcode = useCallback(
    (scanningResult: { data: string }) => {
      if (locked) return;
      const now = Date.now();
      if (now - lastAt.current < 850) return;
      lastAt.current = now;
      setLocked(true);
      setStatusLine("Código lido…");
      onBarcode(scanningResult.data);
    },
    [locked, onBarcode],
  );

  async function onRequestPermission() {
    if (permRequesting) return;
    setPermRequesting(true);
    try {
      await requestPermission();
    } finally {
      setPermRequesting(false);
    }
  }

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
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              active={visible && !locked}
              barcodeScannerSettings={{
                barcodeTypes: [
                  "ean13",
                  "ean8",
                  "code128",
                  "upc_a",
                  "code39",
                  "upc_e",
                  "itf14",
                ],
              }}
              onBarcodeScanned={locked ? undefined : handleBarcode}
            />
            {statusLine ? (
              <View style={styles.statusBar}>
                <Text style={styles.statusText}>{statusLine}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackText}>
              Precisamos da câmara para ler o código do produto.
            </Text>
            <Pressable
              style={[styles.permBtn, permRequesting && { opacity: 0.6 }]}
              disabled={permRequesting}
              onPress={() => void onRequestPermission()}
            >
              {permRequesting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.permBtnText}>Permitir câmara</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
