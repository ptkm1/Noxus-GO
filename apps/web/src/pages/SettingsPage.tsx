import {
  FormErrorBanner,
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { useConfirm } from "@/components/confirm";
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
import { Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type OrderSituation = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
  isSystem: boolean;
};

export function SettingsPage() {
  const qc = useQueryClient();
  const { confirm, alert } = useConfirm();
  const { data: situations = [], isLoading } = useQuery({
    queryKey: ["admin", "order-situations", "all"],
    queryFn: () =>
      apiFetch<OrderSituation[]>("/admin/order-situations?all=1"),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<OrderSituation | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sortOrder, setSortOrder] = useState("100");
  const [active, setActive] = useState(true);
  const [formHint, setFormHint] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  function resetForm() {
    setEditing(null);
    setName("");
    setCode("");
    setSortOrder("100");
    setActive(true);
    setFormHint(null);
    setShowValidation(false);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(s: OrderSituation) {
    setEditing(s);
    setName(s.name);
    setCode(s.code);
    setSortOrder(String(s.sortOrder));
    setActive(s.active);
    setFormHint(null);
    setShowValidation(false);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  const fieldErrors = useMemo(() => {
    if (!showValidation) return {} as Record<string, string>;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Nome é obrigatório.";
    return errs;
  }, [showValidation, name]);

  useScrollToFirstError(fieldErrors, { enabled: showValidation });

  const create = useMutation({
    meta: { inlineError: true },
    mutationFn: (payload: { name: string; code?: string; sortOrder?: number }) =>
      apiFetch<OrderSituation>("/admin/order-situations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "order-situations"] });
      closeSheet();
    },
    onError: (e: Error) => setFormHint(e.message),
  });

  const update = useMutation({
    meta: { inlineError: true },
    mutationFn: (payload: {
      id: string;
      name: string;
      sortOrder: number;
      active: boolean;
    }) =>
      apiFetch<OrderSituation>(`/admin/order-situations/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: payload.name,
          sortOrder: payload.sortOrder,
          active: payload.active,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "order-situations"] });
      closeSheet();
    },
    onError: (e: Error) => setFormHint(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/order-situations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "order-situations"] });
    },
    onError: async (e: Error) => {
      await alert({
        title: "Não foi possível excluir",
        description: e.message,
        tone: "danger",
      });
    },
  });

  function trySave() {
    setShowValidation(true);
    if (!name.trim()) return;
    const sort = Number(sortOrder);
    const sortVal = Number.isFinite(sort) ? Math.trunc(sort) : 100;
    if (editing) {
      update.mutate({
        id: editing.id,
        name: name.trim(),
        sortOrder: sortVal,
        active,
      });
    } else {
      create.mutate({
        name: name.trim(),
        code: code.trim() || undefined,
        sortOrder: sortVal,
      });
    }
  }

  async function confirmDelete(s: OrderSituation) {
    if (s.isSystem) {
      await alert({
        title: "Situação padrão",
        description:
          "Situações padrão não podem ser excluídas. Desative-as na edição.",
        tone: "default",
      });
      return;
    }
    const ok = await confirm({
      title: "Excluir situação?",
      description: `Remover “${s.name}”? Só é permitido se nenhum pedido a usar.`,
      confirmLabel: "Excluir",
      tone: "destructive",
    });
    if (ok) remove.mutate(s.id);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Settings className="size-6 text-muted-foreground" />
            Configurações
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Preferências operacionais da organização.
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Situações de pedido
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Situação operacional (Enviado, Entregue, etc.), independente do
              status do sistema (Rascunho, Confirmado, Cancelado).
            </p>
          </div>
          <Button type="button" onClick={openCreate}>
            Nova situação
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : situations.length === 0 ? (
          <div className="surface-card px-6 py-12 text-center text-sm text-muted-foreground">
            Nenhuma situação cadastrada.
          </div>
        ) : (
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {situations.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell className="tabular-nums">{s.sortOrder}</TableCell>
                    <TableCell>{s.active ? "Sim" : "Não"}</TableCell>
                    <TableCell>
                      {s.isSystem ? "Padrão" : "Personalizada"}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        className="text-primary"
                        onClick={() => openEdit(s)}
                      >
                        Editar
                      </button>
                      {!s.isSystem ? (
                        <button
                          type="button"
                          className="ml-3 text-destructive"
                          disabled={remove.isPending}
                          onClick={() => void confirmDelete(s)}
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
      </section>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title={editing ? "Editar situação" : "Nova situação"}
        description={
          editing?.isSystem
            ? "Situações padrão permitem renomear e ativar/desativar; o código é fixo."
            : "O código é gerado a partir do nome se você deixar em branco."
        }
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={trySave}
            submitLabel={editing ? "Salvar" : "Criar"}
            pending={create.isPending || update.isPending}
          />
        }
      >
        {formHint ? <FormErrorBanner message={formHint} /> : null}
        <FormGrid cols={2}>
          <FormField
            label="Nome"
            htmlFor="sit-name"
            required
            error={fieldErrors.name}
            className="sm:col-span-2"
          >
            <Input
              id="sit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField
            label="Código"
            htmlFor="sit-code"
            hint={
              editing
                ? "Código não pode ser alterado."
                : "Opcional — gerado do nome se vazio."
            }
          >
            <Input
              id="sit-code"
              value={code}
              disabled={!!editing}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono uppercase"
            />
          </FormField>
          <FormField label="Ordem" htmlFor="sit-sort">
            <Input
              id="sit-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </FormField>
          {editing ? (
            <FormField label="Ativa" htmlFor="sit-active" className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="sit-active"
                  checked={active}
                  onCheckedChange={(v) => setActive(v === true)}
                />
                Situação disponível para seleção nos pedidos
              </label>
            </FormField>
          ) : null}
        </FormGrid>
      </FormSheet>
    </div>
  );
}
