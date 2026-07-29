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

export type OrderSituation = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
  isSystem: boolean;
  mapsToCancel: boolean;
};

/** Gera código UPPER_SNAKE_CASE a partir do nome (ex.: "Em separação" → "EM_SEPARACAO"). */
export function situationCodeFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function OrderSituationsPanel() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { data: situations = [], isLoading } = useQuery({
    queryKey: ["admin", "order-situations"],
    queryFn: () => apiFetch<OrderSituation[]>("/admin/order-situations"),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [mapsToCancel, setMapsToCancel] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  function resetForm() {
    setEditingId(null);
    setName("");
    setSortOrder("0");
    setActive(true);
    setMapsToCancel(false);
    setFormError(null);
    setShowValidation(false);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(row: OrderSituation) {
    setEditingId(row.id);
    setName(row.name);
    setSortOrder(String(row.sortOrder));
    setActive(row.active);
    setMapsToCancel(row.mapsToCancel);
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
      const sortN = Number(sortOrder);
      const sort = Number.isFinite(sortN) ? Math.max(0, Math.trunc(sortN)) : 0;
      const trimmedName = name.trim();
      if (editingId) {
        const payload = {
          name: trimmedName,
          sortOrder: sort,
          active,
          mapsToCancel,
        };
        return apiFetch<OrderSituation>(
          `/admin/order-situations/${editingId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      }
      const payload = {
        code: situationCodeFromName(trimmedName),
        name: trimmedName,
        sortOrder: sort,
        active,
        mapsToCancel,
      };
      return apiFetch<OrderSituation>("/admin/order-situations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "order-situations"] });
      closeSheet();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/order-situations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "order-situations"] });
    },
  });

  const patchActive = useMutation({
    mutationFn: (body: { id: string; active: boolean }) =>
      apiFetch(`/admin/order-situations/${body.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: body.active }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "order-situations"] });
    },
  });

  function submitSave() {
    setShowValidation(true);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(null);
      return;
    }
    if (!editingId && !situationCodeFromName(trimmedName)) {
      setFormError(
        "Não foi possível gerar um código a partir do nome. Use letras ou números.",
      );
      return;
    }
    setFormError(null);
    save.mutate();
  }

  const fieldErrors = useMemo(() => {
    if (!showValidation) return {} as Record<string, string>;
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome é obrigatório.";
    return e;
  }, [showValidation, name]);

  useScrollToFirstError(
    Object.keys(fieldErrors).length > 0 ? fieldErrors : formError,
    { enabled: showValidation || Boolean(formError) },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Situações operacionais (enviado, entregue, etc.). São independentes do
          status financeiro do pedido (rascunho, confirmado, crédito).
        </p>
        <Button type="button" className="shrink-0" onClick={openCreate}>
          Nova situação
        </Button>
      </div>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title={editingId ? "Editar situação" : "Nova situação"}
        description="Nome, ordem de exibição e opções da situação."
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
            label="Nome"
            htmlFor="os-name"
            required
            className="sm:col-span-2"
            hint={
              editingId
                ? undefined
                : "O código interno é gerado automaticamente a partir do nome."
            }
            error={fieldErrors.name}
          >
            <Input
              id="os-name"
              placeholder="Ex.: Em separação"
              aria-invalid={fieldErrors.name ? true : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField
            label="Ordem de exibição"
            htmlFor="os-sort"
            hint="Menor número aparece primeiro"
          >
            <Input
              id="os-sort"
              type="number"
              min={0}
              step={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </FormField>
          <FormField
            label="Ativa"
            htmlFor="os-active"
            className="sm:col-span-1"
          >
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                id="os-active"
                checked={active}
                onCheckedChange={(v) => setActive(v === true)}
              />
              Disponível para seleção nos pedidos
            </label>
          </FormField>
          <FormField
            label="Cancelamento operacional"
            htmlFor="os-cancel"
            className="sm:col-span-2"
            hint="Marca a situação como cancelada na operação (não altera o status financeiro)."
          >
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                id="os-cancel"
                checked={mapsToCancel}
                onCheckedChange={(v) => setMapsToCancel(v === true)}
              />
              Representa cancelamento
            </label>
          </FormField>
        </FormGrid>
        {formError ? (
          <FormErrorBanner message={formError} className="mt-3" />
        ) : null}
      </FormSheet>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : situations.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhuma situação cadastrada ainda.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Ordem</TableHead>
                <TableHead className="px-4">Código</TableHead>
                <TableHead className="px-4">Nome</TableHead>
                <TableHead className="px-4">Ativa</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {situations.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {row.sortOrder}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-mono text-xs text-foreground">
                    {row.code}
                    {row.isSystem ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        padrão
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {row.name}
                    {row.mapsToCancel ? (
                      <span className="ml-2 text-xs text-destructive">
                        cancelamento
                      </span>
                    ) : null}
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
                        row.active ? "Desativar situação" : "Ativar situação"
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
                    {!row.isSystem ? (
                      <button
                        type="button"
                        className="ml-3 text-destructive"
                        onClick={() => {
                          void confirm({
                            title: "Excluir situação?",
                            description: `A situação “${row.name}” será removida. Pedidos existentes ficam sem situação.`,
                            confirmLabel: "Excluir",
                            tone: "destructive",
                          }).then((ok) => {
                            if (ok) remove.mutate(row.id);
                          });
                        }}
                      >
                        Excluir
                      </button>
                    ) : null}
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
