import {
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { notifyError, notifySuccess } from "@/lib/app-notifications";
import type { BoletoDetail } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boleto: BoletoDetail | null;
  onDone: (openPdf: boolean, id?: string) => void;
};

export function EditBoletoSheet({
  open,
  onOpenChange,
  boleto,
  onDone,
}: Props) {
  const fields = new Set(boleto?.editableFields ?? []);
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [instructions, setInstructions] = useState("");
  const [interestPercent, setInterestPercent] = useState("");
  const [finePercent, setFinePercent] = useState("");

  useEffect(() => {
    if (!boleto || !open) return;
    setDueDate(boleto.dueDate.slice(0, 10));
    setAmount(String(boleto.amount));
    setInstructions(boleto.instructions ?? "");
    setInterestPercent(
      boleto.interestPercent != null ? String(boleto.interestPercent) : "",
    );
    setFinePercent(
      boleto.finePercent != null ? String(boleto.finePercent) : "",
    );
  }, [boleto, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!boleto) throw new Error("Boleto inválido");
      const body: Record<string, unknown> = {};
      if (fields.has("dueDate") && dueDate) {
        body.dueDate = new Date(dueDate + "T12:00:00").toISOString();
      }
      if (fields.has("amount") && amount) body.amount = Number(amount);
      if (fields.has("instructions")) {
        body.instructions = instructions.trim() || null;
      }
      if (fields.has("interestPercent") && interestPercent !== "") {
        body.interestPercent = Number(interestPercent);
      }
      if (fields.has("finePercent") && finePercent !== "") {
        body.finePercent = Number(finePercent);
      }
      return apiFetch<{ openPdf?: boolean; boleto?: { id: string } }>(
        `/admin/boletos/${boleto.id}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
    },
    onSuccess: (res) => {
      notifySuccess("Boleto atualizado");
      onDone(Boolean(res.openPdf), boleto?.id);
      onOpenChange(false);
    },
    onError: (e) => notifyError(getErrorMessage(e)),
  });

  if (!boleto) return null;
  if (fields.size === 0) {
    return (
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Editar boleto"
        description="Este banco não permite edição via API."
        footer={
          <FormSheetActions
            onCancel={() => onOpenChange(false)}
            onSubmit={() => onOpenChange(false)}
            submitLabel="Fechar"
            pending={false}
          />
        }
      >
        <p className="text-sm text-muted-foreground">
          Use cancelar + reemitir se precisar alterar vencimento ou valor.
        </p>
      </FormSheet>
    );
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar boleto"
      description="Somente campos suportados pelo banco."
      footer={
        <FormSheetActions
          onCancel={() => onOpenChange(false)}
          onSubmit={() => save.mutate()}
          submitLabel="Salvar"
          pending={save.isPending}
        />
      }
    >
      <FormGrid cols={2}>
        {fields.has("dueDate") ? (
          <FormField label="Vencimento" htmlFor="edit-due">
            <Input
              id="edit-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </FormField>
        ) : null}
        {fields.has("amount") ? (
          <FormField label="Valor" htmlFor="edit-amt">
            <Input
              id="edit-amt"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormField>
        ) : null}
        {fields.has("interestPercent") ? (
          <FormField label="Juros %" htmlFor="edit-juros">
            <Input
              id="edit-juros"
              type="number"
              step="0.01"
              value={interestPercent}
              onChange={(e) => setInterestPercent(e.target.value)}
            />
          </FormField>
        ) : null}
        {fields.has("finePercent") ? (
          <FormField label="Multa %" htmlFor="edit-multa">
            <Input
              id="edit-multa"
              type="number"
              step="0.01"
              value={finePercent}
              onChange={(e) => setFinePercent(e.target.value)}
            />
          </FormField>
        ) : null}
        {fields.has("instructions") ? (
          <FormField
            label="Instruções"
            htmlFor="edit-inst"
            className="sm:col-span-2"
          >
            <Input
              id="edit-inst"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </FormField>
        ) : null}
      </FormGrid>
    </FormSheet>
  );
}
