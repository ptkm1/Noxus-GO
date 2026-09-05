import {
  FormField,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { notifyError, notifySuccess } from "@/lib/app-notifications";
import type { BoletoRow } from "./types";
import { EVENT_ACTION_LABEL, type BoletoDetail } from "./types";

type HistoryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: BoletoDetail | null;
};

export function BoletoHistorySheet({
  open,
  onOpenChange,
  detail,
}: HistoryProps) {
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Histórico do boleto"
      description={detail?.customerName ?? undefined}
      footer={
        <FormSheetActions
          onCancel={() => onOpenChange(false)}
          onSubmit={() => onOpenChange(false)}
          submitLabel="Fechar"
          pending={false}
        />
      }
    >
      {!detail?.events?.length ? (
        <p className="text-sm text-muted-foreground">Sem eventos ainda.</p>
      ) : (
        <ul className="space-y-3">
          {detail.events.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {EVENT_ACTION_LABEL[e.action] ?? e.action}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{e.message}</p>
              {e.actorUser ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  por {e.actorUser.name}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </FormSheet>
  );
}

type CancelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boleto: BoletoRow | null;
  onDone: () => void;
};

export function CancelBoletoSheet({
  open,
  onOpenChange,
  boleto,
  onDone,
}: CancelProps) {
  const [reason, setReason] = useState("");
  const cancel = useMutation({
    mutationFn: async () => {
      if (!boleto) throw new Error("Boleto inválido");
      return apiFetch(`/admin/boletos/${boleto.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
    },
    onSuccess: () => {
      notifySuccess("Boleto cancelado");
      setReason("");
      onDone();
      onOpenChange(false);
    },
    onError: (e) => notifyError(getErrorMessage(e)),
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cancelar boleto"
      description="Baixa o título no banco (quando suportado) e marca como cancelado."
      footer={
        <FormSheetActions
          onCancel={() => onOpenChange(false)}
          onSubmit={() => cancel.mutate()}
          submitLabel="Cancelar boleto"
          pending={cancel.isPending}
        />
      }
    >
      <FormField label="Motivo (opcional)" htmlFor="cancel-reason">
        <Input
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex.: Cliente pediu cancelamento"
        />
      </FormField>
    </FormSheet>
  );
}
