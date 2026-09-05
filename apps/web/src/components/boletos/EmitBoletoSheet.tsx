import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, fetchAuthenticatedBlob, openPdfBlob } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { notifyError, notifySuccess } from "@/lib/app-notifications";
import type { EligibleOrder, BankConnectionBrief } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: EligibleOrder | null;
  onDone: (openPdfIds: string[]) => void;
};

export function EmitBoletoSheet({
  open,
  onOpenChange,
  order,
  onDone,
}: Props) {
  const [bankConnectionId, setBankConnectionId] = useState("");
  const [installmentMode, setInstallmentMode] = useState<"all" | "one">("all");
  const [installmentIndex, setInstallmentIndex] = useState("1");
  const [instructions, setInstructions] = useState("");

  const { data: connections = [] } = useQuery({
    queryKey: ["admin", "banking", "connections"],
    queryFn: () =>
      apiFetch<BankConnectionBrief[]>("/admin/banking/connections"),
    enabled: open,
  });

  const active = connections.filter((c) => c.status === "ACTIVE");

  const emit = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("Pedido inválido");
      const bankId = bankConnectionId || active[0]?.id;
      if (!bankId) throw new Error("Selecione uma conexão bancária ACTIVE");
      return apiFetch<{
        openPdfIds: string[];
        openPdf?: boolean;
      }>("/admin/boletos/emit", {
        method: "POST",
        body: JSON.stringify({
          orderId: order.id,
          bankConnectionId: bankId,
          installmentIndex:
            installmentMode === "one"
              ? Number(installmentIndex)
              : undefined,
          instructions: instructions.trim() || undefined,
        }),
      });
    },
    onSuccess: (res) => {
      notifySuccess("Boleto(s) emitido(s)");
      onDone(res.openPdfIds ?? []);
      onOpenChange(false);
    },
    onError: (e) => notifyError(getErrorMessage(e)),
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Emitir boleto"
      description={
        order
          ? `Pedido ${order.orderNumber ?? order.id.slice(0, 8)} · ${order.customer?.name ?? "—"}`
          : undefined
      }
      footer={
        <FormSheetActions
          onCancel={() => onOpenChange(false)}
          onSubmit={() => emit.mutate()}
          submitLabel="Emitir"
          pending={emit.isPending}
        />
      }
    >
      <FormGrid cols={1}>
        <FormField label="Conexão bancária" htmlFor="emit-bank">
          <AppSelect
            id="emit-bank"
            value={bankConnectionId || active[0]?.id || ""}
            onValueChange={setBankConnectionId}
            options={active.map((c) => ({
              value: c.id,
              label: `${c.provider}${c.metadata?.label ? ` · ${c.metadata.label}` : ""}`,
            }))}
            placeholder={
              active.length ? "Selecione" : "Nenhuma conexão ACTIVE"
            }
          />
        </FormField>
        <FormField label="Parcelas" htmlFor="emit-mode">
          <AppSelect
            id="emit-mode"
            value={installmentMode}
            onValueChange={(v) => setInstallmentMode(v as "all" | "one")}
            options={[
              {
                value: "all",
                label: `Todas pendentes (${order?.openInstallments ?? 0})`,
              },
              { value: "one", label: "Somente uma parcela" },
            ]}
          />
        </FormField>
        {installmentMode === "one" ? (
          <FormField label="Nº da parcela" htmlFor="emit-idx">
            <Input
              id="emit-idx"
              type="number"
              min={1}
              max={order?.totalInstallments ?? 1}
              value={installmentIndex}
              onChange={(e) => setInstallmentIndex(e.target.value)}
            />
          </FormField>
        ) : null}
        <FormField label="Instruções (opcional)" htmlFor="emit-inst">
          <Input
            id="emit-inst"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ex.: Não receber após o vencimento"
          />
        </FormField>
      </FormGrid>
      {order?.issues?.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-700">
          {order.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!order?.canEmit || emit.isPending}
          onClick={() => emit.mutate()}
        >
          Confirmar emissão
        </Button>
      </div>
    </FormSheet>
  );
}

export async function openBoletoPdfs(ids: string[]) {
  for (const id of ids) {
    try {
      const blob = await fetchAuthenticatedBlob(`/admin/boletos/${id}/pdf`);
      const url = openPdfBlob(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      notifyError(getErrorMessage(e));
    }
  }
}
