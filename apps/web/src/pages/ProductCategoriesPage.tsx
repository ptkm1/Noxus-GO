import {
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
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
import { useState } from "react";
import { Link } from "react-router-dom";
import { CategorySchemaBuilder } from "../components/CategorySchemaBuilder";
import { apiFetch } from "../lib/api";
import { confirmAction } from "../lib/app-notifications";
import {
  buildSchemaFromDrafts,
  parseSchemaToDrafts,
  type SchemaFieldDraft,
} from "../lib/categorySchemaDraft";

type ProductCategory = {
  id: string;
  code: string;
  name: string;
  commissionPercent?: unknown | null;
  attributeSchema?: unknown;
};

export function ProductCategoriesPage() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin", "product-categories"],
    queryFn: () => apiFetch<ProductCategory[]>("/admin/product-categories"),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [schemaDrafts, setSchemaDrafts] = useState<SchemaFieldDraft[]>([]);
  const [formHint, setFormHint] = useState<string | null>(null);

  function resetForm() {
    setEditing(null);
    setCode("");
    setName("");
    setCommissionPercent("");
    setSchemaDrafts([]);
    setFormHint(null);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(c: ProductCategory) {
    setEditing(c);
    setCode(c.code);
    setName(c.name);
    setCommissionPercent(
      c.commissionPercent != null ? String(Number(c.commissionPercent)) : "",
    );
    setSchemaDrafts(parseSchemaToDrafts(c.attributeSchema));
    setFormHint(null);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  const create = useMutation({
    meta: { inlineError: true },
    mutationFn: (payload: {
      code: string;
      name: string;
      attributeSchema?: unknown;
      commissionPercent?: number | null;
    }) =>
      apiFetch<ProductCategory>("/admin/product-categories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "product-categories"] });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      closeSheet();
    },
    onError: (e: Error) => setFormHint(e.message),
  });

  const update = useMutation({
    meta: { inlineError: true },
    mutationFn: (payload: {
      id: string;
      name: string;
      code: string;
      attributeSchema: unknown;
      commissionPercent?: number | null;
    }) =>
      apiFetch<ProductCategory>(`/admin/product-categories/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: payload.name.trim(),
          code: payload.code.trim(),
          attributeSchema: payload.attributeSchema,
          commissionPercent: payload.commissionPercent,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "product-categories"] });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      closeSheet();
    },
    onError: (e: Error) => setFormHint(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/product-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "product-categories"] });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  function parseCommissionInput(raw: string): number | null | "invalid" {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isNaN(n) || n < 0 || n > 100) return "invalid";
    return n;
  }

  function submitSave() {
    const built = buildSchemaFromDrafts(schemaDrafts);
    if (!built.ok) {
      setFormHint(built.message);
      return;
    }
    const commission = parseCommissionInput(commissionPercent);
    if (commission === "invalid") {
      setFormHint("Comissão deve ser entre 0 e 100 %.");
      return;
    }
    setFormHint(null);
    if (editing) {
      update.mutate({
        id: editing.id,
        name,
        code,
        attributeSchema: built.schema,
        commissionPercent: commission,
      });
    } else {
      create.mutate({
        code,
        name,
        attributeSchema: built.schema,
        commissionPercent: commission,
      });
    }
  }

  const savePending = editing ? update.isPending : create.isPending;
  const canSave = Boolean(code.trim() && name.trim());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/produtos" className="text-sm text-primary hover:underline">
            ← Voltar para produtos
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Grupos de produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada grupo tem um{" "}
            <strong className="font-medium text-foreground">código</strong>{" "}
            estável e pode definir{" "}
            <strong className="font-medium text-foreground">campos extras</strong>{" "}
            para o cadastro de produtos: texto curto ou longo, número, sim/não ou
            lista de opções — montados em formulário, sem precisar editar JSON.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Use grupos (como Identidade ou Embalagem) para organizar a ficha do
            produto; as chaves internas podem ficar em branco para serem geradas a
            partir do nome do campo.
          </p>
        </div>
        <Button type="button" className="shrink-0" onClick={openCreate}>
          Novo grupo
        </Button>
      </div>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title={editing ? "Editar grupo" : "Novo grupo"}
        description="Código, nome, comissão opcional e schema de campos extras."
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={submitSave}
            submitLabel={editing ? "Salvar alterações" : "Cadastrar"}
            pending={savePending}
            disabled={!canSave}
          />
        }
      >
        <FormGrid cols={2}>
          <FormField
            label="Código"
            htmlFor="cat-code"
            required
            hint="Ex.: FOOD"
          >
            <Input
              id="cat-code"
              placeholder="FOOD"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </FormField>
          <FormField label="Nome exibido" htmlFor="cat-name" required>
            <Input
              id="cat-name"
              placeholder="Alimentos"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField
            label="Comissão do vendedor (%)"
            htmlFor="cat-commission"
            className="sm:col-span-2"
            hint="Usado quando o vendedor é comissionado por grupo de produtos. Opcional."
          >
            <Input
              id="cat-commission"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="Ex.: 5"
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
            />
          </FormField>
        </FormGrid>
        <div className="mt-4 border-t border-border pt-4">
          <CategorySchemaBuilder
            drafts={schemaDrafts}
            onChange={setSchemaDrafts}
            disabled={savePending}
          />
        </div>
        {formHint ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
            {formHint}
          </p>
        ) : null}
      </FormSheet>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Código</TableHead>
                <TableHead className="px-4">Nome</TableHead>
                <TableHead className="px-4">Comissão %</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="px-4 py-3 font-mono text-xs text-foreground">
                    {c.code}
                  </TableCell>
                  <TableCell className="px-4 py-3">{c.name}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {c.commissionPercent != null
                      ? `${Number(c.commissionPercent)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="text-primary font-medium"
                      onClick={() => openEdit(c)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ml-3 text-destructive"
                      onClick={() => {
                        void confirmAction({
                          title: "Excluir grupo?",
                          message: `Excluir o grupo “${c.name}”? Produtos ficarão sem grupo.`,
                          confirmLabel: "Excluir",
                          variant: "destructive",
                        }).then((ok) => {
                          if (ok) remove.mutate(c.id);
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
