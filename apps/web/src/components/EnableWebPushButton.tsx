import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getWebPushStatus,
  subscribeWebPush,
  webPushSupported,
} from "@/lib/web-push";

type Props = {
  /** Ícone compacto para o top bar. */
  compact?: boolean;
};

export function EnableWebPushButton({ compact }: Props) {
  const [status, setStatus] = useState<
    "loading" | "unsupported" | "unconfigured" | "denied" | "subscribed" | "ready"
  >("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!webPushSupported()) {
      setStatus("unsupported");
      return;
    }
    setStatus(await getWebPushStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onEnable() {
    setBusy(true);
    setMsg(null);
    const result = await subscribeWebPush();
    setBusy(false);
    if (result.ok) {
      setStatus("subscribed");
      setMsg("Alertas no navegador ativados.");
    } else {
      setMsg(result.reason);
      void refresh();
    }
  }

  if (status === "loading" || status === "unsupported") return null;
  if (status === "unconfigured") return null;

  if (compact) {
    if (status === "subscribed") return null;
    return (
      <Button
        variant="outline"
        size="icon"
        aria-label="Ativar alertas no navegador"
        title="Ativar alertas no navegador"
        disabled={busy || status === "denied"}
        onClick={() => void onEnable()}
      >
        <BellRing className="h-5 w-5" />
      </Button>
    );
  }

  if (status === "subscribed") {
    return (
      <p className="text-sm text-muted-foreground">
        Alertas no navegador ativos.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
        disabled={busy || status === "denied"}
        onClick={() => void onEnable()}
      >
        {busy ? "Ativando…" : "Ativar alertas no navegador"}
      </button>
      {msg ? (
        <p className="max-w-xs text-right text-xs text-muted-foreground">{msg}</p>
      ) : null}
      {status === "denied" ? (
        <p className="max-w-xs text-right text-xs text-destructive">
          Permissão bloqueada nas configurações do navegador.
        </p>
      ) : null}
    </div>
  );
}
