import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ToastItem = {
  id: string;
  title: string;
  message: string;
};

type ErrorModal = {
  title: string;
  message: string;
};

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Botão de confirmação em destaque destrutivo (excluir, cancelar NF-e, etc.) */
  variant?: "default" | "destructive";
};

export type PromptOptions = {
  title?: string;
  message: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Usa textarea em vez de input de uma linha */
  multiline?: boolean;
  minLength?: number;
  defaultValue?: string;
  variant?: "default" | "destructive";
};

type ConfirmState = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

type PromptState = PromptOptions & {
  resolve: (value: string | null) => void;
};

type AppNotificationsContextValue = {
  notifyError: (message: string, title?: string) => void;
  notifySuccess: (message: string, title?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const AppNotificationsContext = createContext<AppNotificationsContextValue | null>(null);

let globalNotifyError: (message: string, title?: string) => void = () => {};
let globalNotifySuccess: (message: string, title?: string) => void = () => {};
let globalConfirm: (options: ConfirmOptions) => Promise<boolean> = async () => false;
let globalPrompt: (options: PromptOptions) => Promise<string | null> = async () => null;

export function notifyError(message: string, title = "Ocorreu um erro") {
  globalNotifyError(message, title);
}

export function notifySuccess(message: string, title = "Concluído") {
  globalNotifySuccess(message, title);
}

/** Confirmação central estilo SweetAlert. Preferir em vez de `window.confirm`. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return globalConfirm(options);
}

/** Prompt central (ex.: justificativa). Preferir em vez de `window.prompt`. */
export function promptAction(options: PromptOptions): Promise<string | null> {
  return globalPrompt(options);
}

export function AppNotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [errorModal, setErrorModal] = useState<ErrorModal | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [promptError, setPromptError] = useState<string | null>(null);

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

  const confirmCb = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const promptCb = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue ?? "");
      setPromptError(null);
      setPromptState({ ...options, resolve });
    });
  }, []);

  useEffect(() => {
    globalNotifyError = notifyErrorCb;
    globalNotifySuccess = notifySuccessCb;
    globalConfirm = confirmCb;
    globalPrompt = promptCb;
    return () => {
      globalNotifyError = () => {};
      globalNotifySuccess = () => {};
      globalConfirm = async () => false;
      globalPrompt = async () => null;
    };
  }, [notifyErrorCb, notifySuccessCb, confirmCb, promptCb]);

  const value = useMemo(
    () => ({
      notifyError: notifyErrorCb,
      notifySuccess: notifySuccessCb,
      confirm: confirmCb,
      prompt: promptCb,
    }),
    [notifyErrorCb, notifySuccessCb, confirmCb, promptCb],
  );

  function closeConfirm(ok: boolean) {
    confirmState?.resolve(ok);
    setConfirmState(null);
  }

  function closePrompt(value: string | null) {
    promptState?.resolve(value);
    setPromptState(null);
    setPromptValue("");
    setPromptError(null);
  }

  function submitPrompt() {
    if (!promptState) return;
    const trimmed = promptValue.trim();
    const min = promptState.minLength ?? 0;
    if (min > 0 && trimmed.length < min) {
      setPromptError(`Informe pelo menos ${min} caracteres.`);
      return;
    }
    closePrompt(trimmed);
  }

  return (
    <AppNotificationsContext.Provider value={value}>
      {children}

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

      <Dialog
        open={confirmState !== null}
        onOpenChange={(open) => {
          if (!open) closeConfirm(false);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="items-center text-center sm:text-center">
            <div
              className={cn(
                "mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full",
                confirmState?.variant === "destructive"
                  ? "bg-destructive/10"
                  : "bg-amber-500/15",
              )}
            >
              {confirmState?.variant === "destructive" ? (
                <AlertTriangle className="h-9 w-9 text-destructive" />
              ) : (
                <HelpCircle className="h-9 w-9 text-amber-600" />
              )}
            </div>
            <DialogTitle className="text-xl">
              {confirmState?.title ?? "Confirmar ação"}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-wrap text-center text-base text-foreground/80">
              {confirmState?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="outline"
              className="min-w-28"
              onClick={() => closeConfirm(false)}
            >
              {confirmState?.cancelLabel ?? "Cancelar"}
            </Button>
            <Button
              type="button"
              variant={confirmState?.variant === "destructive" ? "destructive" : "default"}
              className="min-w-28"
              onClick={() => closeConfirm(true)}
            >
              {confirmState?.confirmLabel ?? "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={promptState !== null}
        onOpenChange={(open) => {
          if (!open) closePrompt(null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="items-center text-center sm:text-center">
            <div
              className={cn(
                "mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full",
                promptState?.variant === "destructive"
                  ? "bg-destructive/10"
                  : "bg-primary/10",
              )}
            >
              {promptState?.variant === "destructive" ? (
                <AlertTriangle className="h-9 w-9 text-destructive" />
              ) : (
                <HelpCircle className="h-9 w-9 text-primary" />
              )}
            </div>
            <DialogTitle className="text-xl">
              {promptState?.title ?? "Informe um valor"}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-wrap text-center text-base text-foreground/80">
              {promptState?.message}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {promptState?.multiline ? (
              <Textarea
                autoFocus
                rows={4}
                placeholder={promptState.placeholder}
                value={promptValue}
                onChange={(e) => {
                  setPromptValue(e.target.value);
                  setPromptError(null);
                }}
              />
            ) : (
              <Input
                autoFocus
                placeholder={promptState?.placeholder}
                value={promptValue}
                onChange={(e) => {
                  setPromptValue(e.target.value);
                  setPromptError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitPrompt();
                  }
                }}
              />
            )}
            {promptError ? <p className="text-sm text-destructive">{promptError}</p> : null}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="outline"
              className="min-w-28"
              onClick={() => closePrompt(null)}
            >
              {promptState?.cancelLabel ?? "Cancelar"}
            </Button>
            <Button
              type="button"
              variant={promptState?.variant === "destructive" ? "destructive" : "default"}
              className="min-w-28"
              onClick={submitPrompt}
            >
              {promptState?.confirmLabel ?? "Confirmar"}
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
