import { AppToast, type AppToastTone } from "@/components/molecules/AppToast";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ShowToastOptions = {
  message: string;
  tone?: AppToastTone;
  /** ms (padrão 2800) */
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (options: ShowToastOptions) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<AppToastTone>("success");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    setMessage("");
  }, []);

  const showToast = useCallback(
    ({
      message: next,
      tone: nextTone = "success",
      durationMs = 2800,
    }: ShowToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setTone(nextTone);
      setMessage(next);
      setVisible(true);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setMessage("");
        timerRef.current = null;
      }, durationMs);
    },
    [],
  );

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.root} pointerEvents="box-none">
        {children}
        <AppToast
          visible={visible}
          message={message}
          tone={tone}
          onDismiss={dismissToast}
          bottomOffset={Math.max(insets.bottom, 12) + 16}
        />
      </View>
    </ToastContext.Provider>
  );
}

export function useAppToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useAppToast must be used within ToastProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
