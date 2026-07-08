import {
  FormActions,
  FormField,
  FormGrid,
  FormSection,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type Supplier = {
  id: string;
  code: string;
  legalName: string;
  cnpj: string;
  tradeName: string;
  active: boolean;
};

function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function maskCnpjInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function SuppliersPage() {
  const qc = useQueryClient();
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["admin", "suppliers"],
    queryFn: () => apiFetch<Supplier[]>("/admin/suppliers"),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [legalName, setLegalName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const editing = suppliers.find((s) => s.id === editingId);

  useEffect(() => {
    if (editing) {
      setCode(editing.code);
      setLegalName(editing.legalName);
      setCnpj(formatCnpj(editing.cnpj));
      setTradeName(editing.tradeName);
    }
  }, [editing]);

  function resetForm() {
    setEditingId(null);
    setCode("");
    setLegalName("");
    setCnpj("");
    setTradeName("");
    setFormError(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        code: code.trim(),
        legalName: legalName.trim(),
        cnpj: cnpj.replace(/\D/g, ""),
        tradeName: tradeName.trim(),
      };
      if (editingId) {
        return apiFetch<Supplier>(`/admin/suppliers/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<Supplier>("/admin/suppliers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      resetForm();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/suppliers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      resetForm();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const canSave =
    code.trim().length > 0 &&
    legalName.trim().length > 0 &&
    cnpj.replace(/\D/g, "").length === 14 &&
    tradeName.trim().length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Fornecedores</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cadastre fornecedores com código interno, razão social, CNPJ e nome
          fantasia para vincular aos produtos.
        </p>
      </div>

      <FormSection title={editingId ? "Editar fornecedor" : "Novo fornecedor"}>
        <FormGrid cols={2} className="max-w-3xl">
          <FormField label="Código do fornecedor" htmlFor="sup-code" required>
            <Input
              id="sup-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex.: BISC-CROC"
            />
          </FormField>
          <FormField label="CNPJ" htmlFor="sup-cnpj" required>
            <Input
              id="sup-cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(maskCnpjInput(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
            />
          </FormField>
          <FormField
            label="Razão social"
            htmlFor="sup-legal"
            required
            className="sm:col-span-2"
          >
            <Input
              id="sup-legal"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Ex.: Indústria e Comércio de Biscoitos Crocante"
            />
          </FormField>
          <FormField
            label="Nome fantasia"
            htmlFor="sup-trade"
            required
            className="sm:col-span-2"
          >
            <Input
              id="sup-trade"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              placeholder="Ex.: BISCOITOS CROCANTE"
            />
          </FormField>
        </FormGrid>

        {formError ? (
          <p className="mt-3 text-sm text-destructive">{formError}</p>
        ) : null}

        <FormActions>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => {
              setFormError(null);
              save.mutate();
            }}
            disabled={!canSave || save.isPending}
          >
            {save.isPending
              ? "Salvando…"
              : editingId
                ? "Salvar alterações"
                : "Cadastrar fornecedor"}
          </Button>
        </FormActions>
      </FormSection>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando fornecedores…</p>
      ) : suppliers.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Nenhum fornecedor cadastrado ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome fantasia</th>
                <th className="px-4 py-3">Razão social</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3 w-36" />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    {s.code}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {s.tradeName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.legalName}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatCnpj(s.cnpj)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="mr-3 text-primary hover:underline"
                      onClick={() => setEditingId(s.id)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-destructive hover:underline"
                      onClick={() => {
                        if (confirm(`Excluir o fornecedor "${s.tradeName}"?`))
                          remove.mutate(s.id);
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
