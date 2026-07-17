import {
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Supplier = { id: string; code: string; tradeName: string };
type FixedExpense = {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  active: boolean;
  notes: string | null;
  competenceLabel: string | null;
  supplierId: string | null;
  costCenterId: string | null;
  historyId: string | null;
  supplier: Supplier | null;
};

const emptyForm = {
  name: "",
  amount: "",
  dayOfMonth: "5",
  supplierId: "",
  costCenterId: "",
  historyId: "",
  notes: "",
  competenceLabel: "",
  active: true,
};

export function FiscalFixedExpensesPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "fixed-expenses"],
    queryFn: () => apiFetch<FixedExpense[]>("/admin/fixed-expenses"),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["admin", "suppliers"],
    queryFn: () => apiFetch<Supplier[]>("/admin/suppliers"),
  });
  const { data: costCenters = [] } = useQuery({
    queryKey: ["admin", "cost-centers"],
    queryFn: () =>
      apiFetch<Array<{ id: string; code: string; name: string }>>(
        "/admin/cost-centers",
      ),
  });
  const { data: histories = [] } = useQuery({
    queryKey: ["admin", "expense-histories"],
    queryFn: () =>
      apiFetch<Array<{ id: string; code: string; description: string }>>(
        "/admin/expense-histories",
      ),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const supplierOpts = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: `${s.code} — ${s.tradeName}`,
      })),
    [suppliers],
  );
  const ccOpts = useMemo(
    () =>
      costCenters.map((c) => ({
        value: c.id,
        label: `${c.code} — ${c.name}`,
      })),
    [costCenters],
  );
  const histOpts = useMemo(
    () =>
      histories.map((h) => ({
        value: h.id,
        label: `${h.code} — ${h.description}`,
      })),
    [histories],
  );

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(row: FixedExpense) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      amount: String(row.amount),
      dayOfMonth: String(row.dayOfMonth),
      supplierId: row.supplierId ?? "",
      costCenterId: row.costCenterId ?? "",
      historyId: row.historyId ?? "",
      notes: row.notes ?? "",
      competenceLabel: row.competenceLabel ?? "",
      active: row.active,
    });
    setFormError(null);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        amount: Number(form.amount),
        dayOfMonth: Number(form.dayOfMonth),
        supplierId: form.supplierId || null,
        costCenterId: form.costCenterId || null,
        historyId: form.historyId || null,
        notes: form.notes.trim() || null,
        competenceLabel: form.competenceLabel.trim() || null,
        active: form.active,
      };
      if (editingId) {
        return apiFetch(`/admin/fixed-expenses/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch("/admin/fixed-expenses", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "fixed-expenses"] });
      closeSheet();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/fixed-expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "fixed-expenses"] });
      closeSheet();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const canSave =
    form.name.trim().length > 0 &&
    Number(form.amount) > 0 &&
    Number(form.dayOfMonth) >= 1 &&
    Number(form.dayOfMonth) <= 28;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <nav className="text-sm text-muted-foreground">
            <Link to="/fiscal" className="hover:text-foreground">
              Fiscal
            </Link>
            <span className="mx-1.5">›</span>
            <span className="text-foreground">Despesas fixas</span>
          </nav>
          <h1 className="text-2xl font-semibold text-foreground">
            Despesas fixas
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Cadastre templates recorrentes para uso futuro em relatórios.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Nova despesa fixa
        </Button>
      </div>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title={editingId ? "Editar despesa fixa" : "Nova despesa fixa"}
        description="Valor, dia do mês e vínculos opcionais."
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {editingId ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => editingId && remove.mutate(editingId)}
                disabled={remove.isPending}
              >
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <FormSheetActions
              onCancel={closeSheet}
              onSubmit={() => {
                setFormError(null);
                save.mutate();
              }}
              submitLabel={editingId ? "Salvar alterações" : "Cadastrar"}
              pending={save.isPending}
              disabled={!canSave}
            />
          </div>
        }
      >
        <FormGrid cols={2}>
          <FormField label="Nome" className="sm:col-span-2" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="Valor (R$)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Dia do mês (1–28)" required>
            <Input
              type="number"
              min="1"
              max="28"
              value={form.dayOfMonth}
              onChange={(e) =>
                setForm((f) => ({ ...f, dayOfMonth: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Fornecedor" className="sm:col-span-2">
            <AppSelect
              value={form.supplierId}
              onValueChange={(v) => setForm((f) => ({ ...f, supplierId: v }))}
              options={supplierOpts}
              emptyLabel="— nenhum —"
            />
          </FormField>
          <FormField label="Centro de custo">
            <AppSelect
              value={form.costCenterId}
              onValueChange={(v) => setForm((f) => ({ ...f, costCenterId: v }))}
              options={ccOpts}
              emptyLabel="— nenhum —"
            />
          </FormField>
          <FormField label="Histórico">
            <AppSelect
              value={form.historyId}
              onValueChange={(v) => setForm((f) => ({ ...f, historyId: v }))}
              options={histOpts}
              emptyLabel="— nenhum —"
            />
          </FormField>
          <FormField label="Competência (rótulo)">
            <Input
              placeholder="ex.: mensal"
              value={form.competenceLabel}
              onChange={(e) =>
                setForm((f) => ({ ...f, competenceLabel: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Observações" className="sm:col-span-2">
            <Input
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Status" className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              Despesa ativa
            </label>
          </FormField>
        </FormGrid>
        {formError ? (
          <p className="mt-3 text-sm text-destructive">{formError}</p>
        ) : null}
      </FormSheet>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Nenhuma despesa fixa cadastrada.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Dia</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {row.amount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell>{row.dayOfMonth}</TableCell>
                  <TableCell>{row.supplier?.tradeName ?? "—"}</TableCell>
                  <TableCell>{row.active ? "Ativa" : "Inativa"}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(row)}
                    >
                      Editar
                    </Button>
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
