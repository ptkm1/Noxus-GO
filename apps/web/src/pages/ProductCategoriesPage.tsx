import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [newSchemaDrafts, setNewSchemaDrafts] = useState<SchemaFieldDraft[]>([]);
  const [formHint, setFormHint] = useState<string | null>(null);

  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editSchemaDrafts, setEditSchemaDrafts] = useState<SchemaFieldDraft[]>([]);

  const create = useMutation({
    mutationFn: (payload: { code: string; name: string; attributeSchema?: unknown }) =>
      apiFetch<ProductCategory>("/admin/product-categories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "product-categories"] });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      setCode("");
      setName("");
      setNewSchemaDrafts([]);
      setFormHint(null);
    },
    onError: (e: Error) => setFormHint(e.message),
  });

  const update = useMutation({
    mutationFn: (payload: {
      id: string;
      name: string;
      code: string;
      attributeSchema: unknown;
    }) =>
      apiFetch<ProductCategory>(`/admin/product-categories/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: payload.name.trim(),
          code: payload.code.trim(),
          attributeSchema: payload.attributeSchema,
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
    setEditSchemaDrafts(parseSchemaToDrafts(c.attributeSchema));
    setFormHint(null);
  }

  function submitCreate() {
    const built = buildSchemaFromDrafts(newSchemaDrafts);
    if (!built.ok) {
      setFormHint(built.message);
      return;
    }
    setFormHint(null);
    create.mutate({
      code,
      name,
      attributeSchema: built.schema,
    });
  }

  function submitEdit() {
    if (!editing) return;
    const built = buildSchemaFromDrafts(editSchemaDrafts);
    if (!built.ok) {
      setFormHint(built.message);
      return;
    }
    setFormHint(null);
    update.mutate({
      id: editing.id,
      name: editName,
      code: editCode,
      attributeSchema: built.schema,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/produtos" className="text-sm text-brand-600 hover:underline">
          ← Voltar para produtos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Categorias de produto</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cada categoria tem um <strong className="font-medium text-slate-800">código</strong> estável e pode definir{" "}
          <strong className="font-medium text-slate-800">campos extras</strong> para o cadastro de produtos: texto curto ou longo,
          número, sim/não ou lista de opções — montados em formulário, sem precisar editar JSON.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Use grupos (como Identidade ou Embalagem) para organizar a ficha do produto; as chaves internas podem ficar em branco para
          serem geradas a partir do nome do campo.
        </p>
      </div>

      {formHint ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formHint}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">Nova categoria</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="Código (ex.: FOOD)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className="min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="Nome exibido"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!code.trim() || !name.trim() || create.isPending}
            onClick={() => submitCreate()}
          >
            Adicionar
          </button>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <CategorySchemaBuilder
            drafts={newSchemaDrafts}
            onChange={setNewSchemaDrafts}
            disabled={create.isPending}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {categories.map((c) =>
                editing?.id === c.id ? (
                  <Fragment key={c.id}>
                    <tr className="border-t border-slate-100 bg-brand-50/40">
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
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="text-slate-600"
                          onClick={() => {
                            setEditing(null);
                            setFormHint(null);
                          }}
                        >
                          Cancelar
                        </button>
                      </td>
                    </tr>
                    <tr className="bg-brand-50/40">
                      <td className="px-4 pb-4 pt-0" colSpan={3}>
                        <CategorySchemaBuilder
                          drafts={editSchemaDrafts}
                          onChange={setEditSchemaDrafts}
                          disabled={update.isPending}
                        />
                        <button
                          type="button"
                          className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          disabled={!editName.trim() || !editCode.trim() || update.isPending}
                          onClick={() => submitEdit()}
                        >
                          Salvar categoria e schema
                        </button>
                      </td>
                    </tr>
                  </Fragment>
                ) : (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.code}</td>
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" className="text-brand-600 font-medium" onClick={() => startEdit(c)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="ml-3 text-red-600"
                        onClick={() => {
                          if (confirm(`Excluir categoria “${c.name}”? Produtos ficarão sem categoria.`))
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
