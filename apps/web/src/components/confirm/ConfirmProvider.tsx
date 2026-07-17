import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import type { AlertOptions, ConfirmOptions, ConfirmTone } from "./types";

type DialogMode = "confirm" | "alert";

type DialogState = {
  mode: DialogMode;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((result: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setState(null);
    resolve?.(result);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({
        mode: "confirm",
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? "Confirmar",
        cancelLabel: options.cancelLabel ?? "Cancelar",
        tone: options.tone ?? "destructive",
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      resolveRef.current = () => {
        resolve();
      };
      setState({
        mode: "alert",
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? "Entendi",
        cancelLabel: "Cancelar",
        tone: options.tone ?? "danger",
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      {state ? (
        <ConfirmDialog
          open
          mode={state.mode}
          title={state.title}
          description={state.description}
          confirmLabel={state.confirmLabel}
          cancelLabel={state.cancelLabel}
          tone={state.tone}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
          onOpenChange={(open) => {
            if (!open) close(false);
          }}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm deve ser usado dentro de ConfirmProvider");
  }
  return ctx;
}
