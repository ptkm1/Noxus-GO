import {
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { useConfirm } from "@/components/confirm";
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
import { useScrollToFirstError } from "@/hooks/useScrollToFirstError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type PriceTable = {
  id: string;
  name: string;
  items?: unknown[];
  customer: { id: string; name: string } | null;
  seller: { id: string; user: { name: string } } | null;
  region: { id: string; code: string; name: string } | null;
};

function scopeLabel(table: PriceTable): string {
  if (table.customer) return `Cliente: ${table.customer.name}`;
  if (table.seller) return `Vendedor: ${table.seller.user.name}`;
  if (table.region) return `Região: ${table.region.name}`;
  return "Global";
}

export function PriceTablesPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["admin", "price-tables"],
    queryFn: () => apiFetch<PriceTable[]>("/admin/price-tables"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<PriceTable | null>(null);
  const [name, setName] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  function resetForm() {
    setName("");
    setShowValidation(false);
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    resetForm();
  }

  function openEdit(table: PriceTable) {
    setEditing(table);
    setName(table.name);
    setShowValidation(false);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    resetForm();
  }

  const createTable = useMutation({
    mutationFn: () =>
      apiFetch<PriceTable>("/admin/price-tables", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      closeCreate();
    },
  });

  const updateTable = useMutation({
    mutationFn: () =>
      apiFetch<PriceTable>(`/admin/price-tables/${editing!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      closeEdit();
    },
  });

  const delTable = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/price-tables/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
    },
  });

  const createFieldErrors = useMemo(() => {
    if (!showValidation) return {} as Record<string, string>;
    return !name.trim() ? { name: "Nome é obrigatório." } : {};
  }, [showValidation, name]);

  useScrollToFirstError(createFieldErrors, {
    enabled: showValidation && (createOpen || editOpen),
  });

  function tryCreateTable() {
    setShowValidation(true);
    if (!name.trim()) return;
    createTable.mutate();
  }

  function tryUpdateTable() {
    setShowValidation(true);
    if (!name.trim() || !editing) return;
    updateTable.mutate();
  }

  async function confirmDeleteTable(table: PriceTable) {
    const ok = await confirm({
      title: "Excluir tabela?",
      description:
        "A tabela de preços e os preços dos produtos nela serão removidos.",
      confirmLabel: "Excluir",
      tone: "destructive",
    });
    if (ok) delTable.mutate(table.id);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Tabelas de preço
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Crie e gerencie tabelas pelo nome. Os preços dos produtos são
            definidos no cadastro de cada produto.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Nova tabela
        </Button>
      </div>

      <FormSheet
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) closeCreate();
          else setCreateOpen(true);
        }}
        title="Nova tabela"
        description="Informe o nome. Depois associe preços no cadastro do produto."
        footer={
          <FormSheetActions
            onCancel={closeCreate}
            onSubmit={tryCreateTable}
            submitLabel="Criar tabela"
            pending={createTable.isPending}
          />
        }
      >
        <FormGrid cols={1}>
          <FormField
            label="Nome"
            htmlFor="pt-name"
            required
            error={createFieldErrors.name}
          >
            <Input
              id="pt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
        </FormGrid>
      </FormSheet>

      <FormSheet
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEdit();
          else setEditOpen(true);
        }}
        title="Editar tabela"
        description="Altere o nome da tabela de preço."
        footer={
          <FormSheetActions
            onCancel={closeEdit}
            onSubmit={tryUpdateTable}
            submitLabel="Salvar"
            pending={updateTable.isPending}
          />
        }
      >
        <FormGrid cols={1}>
          <FormField
            label="Nome"
            htmlFor="pt-edit-name"
            required
            error={createFieldErrors.name}
          >
            <Input
              id="pt-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
        </FormGrid>
      </FormSheet>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : tables.length === 0 ? (
        <div className="surface-card px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhuma tabela cadastrada.
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {scopeLabel(t)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {t.items?.length ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      className="text-primary"
                      onClick={() => openEdit(t)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ml-3 text-destructive"
                      disabled={delTable.isPending}
                      onClick={() => void confirmDeleteTable(t)}
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
