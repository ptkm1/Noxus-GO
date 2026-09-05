import { useConfirm } from "@/components/confirm";
import {
  FormErrorBanner,
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useScrollToFirstError } from "@/hooks/useScrollToFirstError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type PaymentCondition = {
  id: string;
  code: string;
  name: string;
  days: number;
  installmentDays?: number[];
  active: boolean;
  sortOrder: number;
};

export function PaymentConditionsPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { data: conditions = [], isLoading } = useQuery({
    queryKey: ["admin", "payment-conditions"],
    queryFn: () => apiFetch<PaymentCondition[]>("/admin/payment-conditions"),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [days, setDays] = useState("0");
  const [installmentDays, setInstallmentDays] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  function resetForm() {
    setEditingId(null);
    setCode("");
    setName("");
    setDays("0");
    setInstallmentDays("");
    setSortOrder("0");
    setActive(true);
    setFormError(null);
    setShowValidation(false);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(row: PaymentCondition) {
    setEditingId(row.id);
    setCode(row.code);
    setName(row.name);
    setDays(String(row.days));
    setInstallmentDays(
      row.installmentDays?.length ? row.installmentDays.join(",") : "",
    );
    setSortOrder(String(row.sortOrder));
    setActive(row.active);
    setFormError(null);
    setShowValidation(false);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  const save = useMutation({
    meta: { inlineError: true },
    mutationFn: async () => {
      const daysN = Number(days);
      const sortN = Number(sortOrder);
      const parsedInstallments = installmentDays
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n >= 1);
      const payload = {
        code: code.trim(),
        name: name.trim(),
        days: Number.isFinite(daysN) ? Math.max(0, Math.trunc(daysN)) : 0,
        installmentDays: parsedInstallments,
        sortOrder: Number.isFinite(sortN) ? Math.max(0, Math.trunc(sortN)) : 0,
        active,
      };
      if (editingId) {
        return apiFetch<PaymentCondition>(
          `/admin/payment-conditions/${editingId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      }
      return apiFetch<PaymentCondition>("/admin/payment-conditions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "payment-conditions"] });
      closeSheet();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/payment-conditions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "payment-conditions"] });
    },
  });

  const patchActive = useMutation({
    mutationFn: (body: { id: string; active: boolean }) =>
      apiFetch(`/admin/payment-conditions/${body.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: body.active }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "payment-conditions"] });
    },
  });

  function submitSave() {
    setShowValidation(true);
    if (!code.trim() || !name.trim()) {
      setFormError(null);
      return;
    }
    const daysN = Number(days);
    if (!Number.isFinite(daysN) || daysN < 0) {
      setFormError("Prazo em dias deve ser um número ≥ 0.");
      return;
    }
    setFormError(null);
    save.mutate();
  }

  const fieldErrors = useMemo(() => {
    if (!showValidation) return {} as Record<string, string>;
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = "Código é obrigatório.";
    if (!name.trim()) e.name = "Nome é obrigatório.";
    return e;
  }, [showValidation, code, name]);

  useScrollToFirstError(
    Object.keys(fieldErrors).length > 0 ? fieldErrors : formError,
    { enabled: showValidation || Boolean(formError) },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Condições de pagamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre as condições usadas na digitação de pedidos (à vista,
            boleto em X dias, etc.). Só condições ativas aparecem no app do
            vendedor.
          </p>
        </div>
        <Button type="button" className="shrink-0" onClick={openCreate}>
          Nova condição
        </Button>
      </div>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title={editingId ? "Editar condição" : "Nova condição"}
        description="Código, nome, prazo em dias e ordem de exibição."
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={submitSave}
            submitLabel={editingId ? "Salvar alterações" : "Cadastrar"}
            pending={save.isPending}
          />
        }
      >
        <FormGrid cols={2}>
          <FormField
            label="Código"
            htmlFor="pc-code"
            required
            hint="Ex.: 1 ou AVISTA"
            error={fieldErrors.code}
          >
            <Input
              id="pc-code"
              placeholder="1"
              aria-invalid={fieldErrors.code ? true : undefined}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </FormField>
          <FormField
            label="Nome"
            htmlFor="pc-name"
            required
            error={fieldErrors.name}
          >
            <Input
              id="pc-name"
              placeholder="À vista"
              aria-invalid={fieldErrors.name ? true : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Prazo (dias)" htmlFor="pc-days" hint="0 = à vista">
            <Input
              id="pc-days"
              type="number"
              min={0}
              step={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </FormField>
          <FormField
            label="Parcelas (dias)"
            htmlFor="pc-installments"
            hint="Opcional. Ex.: 30,60,90 — sobrescreve prazo único"
          >
            <Input
              id="pc-installments"
              placeholder="30,60,90"
              value={installmentDays}
              onChange={(e) => setInstallmentDays(e.target.value)}
            />
          </FormField>
          <FormField
            label="Ordem"
            htmlFor="pc-sort"
            hint="Menor número aparece primeiro"
          >
            <Input
              id="pc-sort"
              type="number"
              min={0}
              step={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </FormField>
          <FormField
            label="Ativa"
            htmlFor="pc-active"
            className="sm:col-span-2"
          >
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                id="pc-active"
                checked={active}
                onCheckedChange={(v) => setActive(v === true)}
              />
              Disponível para vendedores no app
            </label>
          </FormField>
        </FormGrid>
        {formError ? (
          <FormErrorBanner message={formError} className="mt-3" />
        ) : null}
      </FormSheet>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : conditions.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhuma condição cadastrada ainda.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Ordem</TableHead>
                <TableHead className="px-4">Código</TableHead>
                <TableHead className="px-4">Nome</TableHead>
                <TableHead className="px-4">Dias</TableHead>
                <TableHead className="px-4">Parcelas</TableHead>
                <TableHead className="px-4">Ativa</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {conditions.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {row.sortOrder}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-mono text-xs text-foreground">
                    {row.code}
                  </TableCell>
                  <TableCell className="px-4 py-3">{row.name}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {row.days === 0 ? "À vista" : `${row.days} dias`}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {row.installmentDays?.length
                      ? row.installmentDays.join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Checkbox
                      checked={row.active}
                      onCheckedChange={(v) =>
                        patchActive.mutate({
                          id: row.id,
                          active: v === true,
                        })
                      }
                      aria-label={
                        row.active ? "Desativar condição" : "Ativar condição"
                      }
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="font-medium text-primary"
                      onClick={() => openEdit(row)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ml-3 text-destructive"
                      onClick={() => {
                        void confirm({
                          title: "Excluir condição?",
                          description: `A condição “${row.name}” será removida. Pedidos existentes ficam sem vínculo.`,
                          confirmLabel: "Excluir",
                          tone: "destructive",
                        }).then((ok) => {
                          if (ok) remove.mutate(row.id);
                        });
                      }}
                    >
                      Excluir
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
