import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ToastItem = {
  id: string;
  title: string;
  message: string;
};

type ErrorModal = {
  title: string;
  message: string;
};

type AppNotificationsContextValue = {
  notifyError: (message: string, title?: string) => void;
  notifySuccess: (message: string, title?: string) => void;
};

const AppNotificationsContext = createContext<AppNotificationsContextValue | null>(null);

// Permite uso fora de componentes React (ex.: QueryClient global).
let globalNotifyError: (message: string, title?: string) => void = () => {};
let globalNotifySuccess: (message: string, title?: string) => void = () => {};

export function notifyError(message: string, title = "Ocorreu um erro") {
  globalNotifyError(message, title);
}

export function notifySuccess(message: string, title = "Concluído") {
  globalNotifySuccess(message, title);
}

export function AppNotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [errorModal, setErrorModal] = useState<ErrorModal | null>(null);

  const notifyErrorCb = useCallback((message: string, title = "Ocorreu um erro") => {
    setErrorModal({ message, title });
  }, []);

  const notifySuccessCb = useCallback((message: string, title = "Concluído") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev.slice(-4), { id, title, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  useEffect(() => {
    globalNotifyError = notifyErrorCb;
    globalNotifySuccess = notifySuccessCb;
    return () => {
      globalNotifyError = () => {};
      globalNotifySuccess = () => {};
    };
  }, [notifyErrorCb, notifySuccessCb]);

  const value = useMemo(
    () => ({ notifyError: notifyErrorCb, notifySuccess: notifySuccessCb }),
    [notifyErrorCb, notifySuccessCb],
  );

  return (
    <AppNotificationsContext.Provider value={value}>
      {children}

      {/* Toasts de sucesso — canto superior direito */}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-md flex-col gap-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <Alert
            key={toast.id}
            className="pointer-events-auto border-emerald-500/40 bg-card shadow-lg"
          >
            <CheckCircle2 className="text-emerald-500" />
            <AlertTitle>{toast.title}</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{toast.message}</AlertDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              aria-label="Fechar aviso"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        ))}
      </div>

      {/* Erros — modal central estilo SweetAlert */}
      <Dialog open={errorModal !== null} onOpenChange={(open) => !open && setErrorModal(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="items-center text-center sm:text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-9 w-9 text-destructive" />
            </div>
            <DialogTitle className="text-xl">{errorModal?.title}</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap text-center text-base text-foreground/80">
              {errorModal?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button type="button" className="min-w-28" onClick={() => setErrorModal(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppNotificationsContext.Provider>
  );
}

export function useAppNotifications() {
  const ctx = useContext(AppNotificationsContext);
  if (!ctx) throw new Error("useAppNotifications deve ser usado dentro de AppNotificationsProvider");
  return ctx;
}
