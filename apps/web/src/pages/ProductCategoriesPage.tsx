import {
  FormActions,
  FormField,
  FormGrid,
  FormSection,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { CategorySchemaBuilder } from "../components/CategorySchemaBuilder";
import { apiFetch } from "../lib/api";
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

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [newSchemaDrafts, setNewSchemaDrafts] = useState<SchemaFieldDraft[]>(
    [],
  );
  const [formHint, setFormHint] = useState<string | null>(null);

  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editCommissionPercent, setEditCommissionPercent] = useState("");
  const [editSchemaDrafts, setEditSchemaDrafts] = useState<SchemaFieldDraft[]>(
    [],
  );

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
      setCode("");
      setName("");
      setCommissionPercent("");
      setNewSchemaDrafts([]);
      setFormHint(null);
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
      setEditing(null);
      setFormHint(null);
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

  function startEdit(c: ProductCategory) {
    setEditing(c);
    setEditName(c.name);
    setEditCode(c.code);
    setEditCommissionPercent(
      c.commissionPercent != null ? String(Number(c.commissionPercent)) : "",
    );
    setEditSchemaDrafts(parseSchemaToDrafts(c.attributeSchema));
    setFormHint(null);
  }

  function parseCommissionInput(raw: string): number | null | "invalid" {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isNaN(n) || n < 0 || n > 100) return "invalid";
    return n;
  }

  function submitCreate() {
    const built = buildSchemaFromDrafts(newSchemaDrafts);
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
    create.mutate({
      code,
      name,
      attributeSchema: built.schema,
      commissionPercent: commission,
    });
  }

  function submitEdit() {
    if (!editing) return;
    const built = buildSchemaFromDrafts(editSchemaDrafts);
    if (!built.ok) {
      setFormHint(built.message);
      return;
    }
    const commission = parseCommissionInput(editCommissionPercent);
    if (commission === "invalid") {
      setFormHint("Comissão deve ser entre 0 e 100 %.");
      return;
    }
    setFormHint(null);
    update.mutate({
      id: editing.id,
      name: editName,
      code: editCode,
      attributeSchema: built.schema,
      commissionPercent: commission,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/produtos" className="text-sm text-primary hover:underline">
          ← Voltar para produtos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Categorias de produto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada categoria tem um{" "}
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

      {formHint ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
          {formHint}
        </p>
      ) : null}

      <FormSection title="Nova categoria">
        <FormGrid cols={2} className="max-w-2xl">
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
        <div className="border-t border-border pt-4">
          <CategorySchemaBuilder
            drafts={newSchemaDrafts}
            onChange={setNewSchemaDrafts}
            disabled={create.isPending}
          />
        </div>
        <FormActions>
          <Button
            type="button"
            disabled={!code.trim() || !name.trim() || create.isPending}
            onClick={() => submitCreate()}
          >
            Adicionar
          </Button>
        </FormActions>
      </FormSection>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Comissão %</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {categories.map((c) =>
                editing?.id === c.id ? (
                  <Fragment key={c.id}>
                    <tr className="border-t border-border bg-primary/10/40">
                      <td className="px-4 py-3">
                        <input
                          className="w-full rounded border px-2 py-1 font-mono text-xs"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-full rounded border px-2 py-1"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          className="w-20 rounded border px-2 py-1"
                          placeholder="—"
                          value={editCommissionPercent}
                          onChange={(e) =>
                            setEditCommissionPercent(e.target.value)
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="text-muted-foreground"
                          onClick={() => {
                            setEditing(null);
                            setFormHint(null);
                          }}
                        >
                          Cancelar
                        </button>
                      </td>
                    </tr>
                    <tr className="bg-primary/10/40">
                      <td className="px-4 pb-4 pt-0" colSpan={4}>
                        <CategorySchemaBuilder
                          drafts={editSchemaDrafts}
                          onChange={setEditSchemaDrafts}
                          disabled={update.isPending}
                        />
                        <button
                          type="button"
                          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          disabled={
                            !editName.trim() ||
                            !editCode.trim() ||
                            update.isPending
                          }
                          onClick={() => submitEdit()}
                        >
                          Salvar categoria e schema
                        </button>
                      </td>
                    </tr>
                  </Fragment>
                ) : (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {c.code}
                    </td>
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.commissionPercent != null
                        ? `${Number(c.commissionPercent)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="text-primary font-medium"
                        onClick={() => startEdit(c)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="ml-3 text-destructive"
                        onClick={() => {
                          if (
                            confirm(
                              `Excluir categoria “${c.name}”? Produtos ficarão sem categoria.`,
                            )
                          )
                            remove.mutate(c.id);
                        }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
