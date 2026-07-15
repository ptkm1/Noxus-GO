import {
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { DatePicker, MonthPicker } from "@/components/ui/date-picker";
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
type ApStatus = "AUTHORIZED" | "PENDING" | "PAID" | "CANCELLED";

type AccountsPayable = {
  id: string;
  docNumber: string;
  supplierId: string;
  issueDate: string;
  dueDate: string;
  competence: string;
  historyId: string | null;
  costCenterId: string | null;
  amount: number;
  notes: string | null;
  status: ApStatus;
  supplier: Supplier & { legalName: string };
};

/** Status úteis no dia a dia (sem o ruído do ERP concorrente). */
const STATUS_LABEL: Record<ApStatus, string> = {
  AUTHORIZED: "Em aberto",
  PENDING: "Pendente",
  PAID: "Pago",
  CANCELLED: "Cancelado",
};

const STATUS_OPTIONS: ApStatus[] = ["AUTHORIZED", "PAID", "CANCELLED"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function competenceMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const emptyForm = {
  docNumber: "",
  supplierId: "",
  issueDate: todayIso(),
  dueDate: todayIso(),
  competence: competenceMonth(),
  historyId: "",
  costCenterId: "",
  amount: "",
  notes: "",
  status: "AUTHORIZED" as ApStatus,
};

export function FiscalAccountsPayablePage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "accounts-payable", statusFilter],
    queryFn: () => {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      return apiFetch<AccountsPayable[]>(`/admin/accounts-payable${q}`);
    },
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

  function openEdit(row: AccountsPayable) {
    setEditingId(row.id);
    setForm({
      docNumber: row.docNumber,
      supplierId: row.supplierId,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      competence: row.competence.slice(0, 7) + "-01",
      historyId: row.historyId ?? "",
      costCenterId: row.costCenterId ?? "",
      amount: String(row.amount),
      notes: row.notes ?? "",
      status: row.status,
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
        docNumber: form.docNumber.trim(),
        supplierId: form.supplierId,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        competence: form.competence,
        amount: Number(form.amount),
        status: form.status,
        historyId: form.historyId || null,
        costCenterId: form.costCenterId || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        return apiFetch(`/admin/accounts-payable/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch("/admin/accounts-payable", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "accounts-payable"] });
      closeSheet();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/accounts-payable/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "accounts-payable"] });
      closeSheet();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const canSave =
    form.docNumber.trim().length > 0 &&
    form.supplierId.length > 0 &&
    Number(form.amount) > 0 &&
    form.issueDate.length > 0 &&
    form.dueDate.length > 0 &&
    form.competence.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <nav className="text-sm text-muted-foreground">
            <Link to="/fiscal" className="hover:text-foreground">
              Fiscal
            </Link>
            <span className="mx-1.5">›</span>
            <span className="text-foreground">Contas a pagar</span>
          </nav>
          <h1 className="text-2xl font-semibold text-foreground">
            Contas a pagar
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Lançamentos simples: fornecedor, datas, valor e status.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Novo lançamento
        </Button>
      </div>

      <div className="max-w-xs">
        <AppSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          emptyLabel="Todos os status"
          options={STATUS_OPTIONS.map((s) => ({
            value: s,
            label: STATUS_LABEL[s],
          }))}
          placeholder="Filtrar status"
        />
      </div>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title={editingId ? "Editar lançamento" : "Novo lançamento"}
        description="Campos essenciais para controle de despesas."
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
              submitLabel={editingId ? "Salvar" : "Lançar"}
              pending={save.isPending}
              disabled={!canSave}
            />
          </div>
        }
      >
        <FormGrid cols={2}>
          <FormField label="Número / referência" required>
            <Input
              value={form.docNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, docNumber: e.target.value }))
              }
              placeholder="Ex.: NF-100 ou aluguel jul/26"
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
          <FormField label="Fornecedor" className="sm:col-span-2" required>
            <AppSelect
              value={form.supplierId}
              onValueChange={(v) => setForm((f) => ({ ...f, supplierId: v }))}
              options={supplierOpts}
              placeholder="Selecione o fornecedor"
            />
          </FormField>
          <FormField label="Emissão" required>
            <DatePicker
              value={form.issueDate}
              onChange={(v) => setForm((f) => ({ ...f, issueDate: v }))}
            />
          </FormField>
          <FormField label="Vencimento" required>
            <DatePicker
              value={form.dueDate}
              onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))}
            />
          </FormField>
          <FormField label="Competência" required>
            <MonthPicker
              value={form.competence}
              onChange={(v) => setForm((f) => ({ ...f, competence: v }))}
            />
          </FormField>
          <FormField label="Status">
            <AppSelect
              value={form.status}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, status: v as ApStatus }))
              }
              options={STATUS_OPTIONS.map((s) => ({
                value: s,
                label: STATUS_LABEL[s],
              }))}
            />
          </FormField>
          <FormField label="Histórico">
            <AppSelect
              value={form.historyId}
              onValueChange={(v) => setForm((f) => ({ ...f, historyId: v }))}
              options={histOpts}
              emptyLabel="— opcional —"
            />
          </FormField>
          <FormField label="Centro de custo">
            <AppSelect
              value={form.costCenterId}
              onValueChange={(v) => setForm((f) => ({ ...f, costCenterId: v }))}
              options={ccOpts}
              emptyLabel="— opcional —"
            />
          </FormField>
          <FormField label="Observações" className="sm:col-span-2">
            <Input
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Opcional"
            />
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
          Nenhum lançamento cadastrado.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.docNumber}</TableCell>
                  <TableCell>{row.supplier.tradeName}</TableCell>
                  <TableCell>
                    {new Date(row.dueDate + "T12:00:00").toLocaleDateString(
                      "pt-BR",
                    )}
                  </TableCell>
                  <TableCell>
                    {row.amount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell>{STATUS_LABEL[row.status]}</TableCell>
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
