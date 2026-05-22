import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FormActions, FormField, FormGrid, FormSection } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fieldControlClass } from "@/lib/field-styles";
import { apiFetch } from "../lib/api";

type Product = { id: string; name: string; basePrice: unknown };
type Item = { id: string; productId: string; price: unknown; product: Product };
type PriceTable = { id: string; name: string; items: Item[] };

export function PriceTablesPage() {
  const qc = useQueryClient();
  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["admin", "price-tables"],
    queryFn: () => apiFetch<PriceTable[]>("/admin/price-tables"),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiFetch<Product[]>("/admin/products"),
  });

  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [itemPrice, setItemPrice] = useState("");

  const createTable = useMutation({
    mutationFn: () => apiFetch<PriceTable>("/admin/price-tables", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      setName("");
    },
  });

  const addItem = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/price-tables/${selectedId}/items`, {
        method: "POST",
        body: JSON.stringify({ productId, price: Number(itemPrice) }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      setItemPrice("");
    },
  });

  const delItem = useMutation({
    mutationFn: ({ tableId, productId: pid }: { tableId: string; productId: string }) =>
      apiFetch(`/admin/price-tables/${tableId}/items/${pid}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] }),
  });

  const delTable = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/price-tables/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      setSelectedId(null);
    },
  });

  const selected = tables.find((t) => t.id === selectedId);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Tabelas de preço</h1>

      <FormSection title="Nova tabela">
        <FormGrid cols={2} className="max-w-xl">
          <FormField label="Nome" htmlFor="pt-name" required className="sm:col-span-2">
            <Input
              id="pt-name"
              placeholder="Nome da nova tabela"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
        </FormGrid>
        <FormActions>
          <Button
            type="button"
            onClick={() => name && createTable.mutate()}
            disabled={!name || createTable.isPending}
          >
            Criar tabela
          </Button>
        </FormActions>
      </FormSection>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 font-medium">Tabelas</div>
            <ul className="divide-y divide-border">
              {tables.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-2">
                  <button
                    type="button"
                    className={`text-left text-sm ${selectedId === t.id ? "font-semibold text-primary" : ""}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    {t.name} <span className="text-muted-foreground">({t.items.length} itens)</span>
                  </button>
                  <button
                    type="button"
                    className="text-xs text-destructive"
                    onClick={() => {
                      if (confirm("Excluir tabela?")) delTable.mutate(t.id);
                    }}
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Selecione uma tabela.</p>
            ) : (
              <>
                <h2 className="font-medium">{selected.name}</h2>
                <FormGrid cols={3} className="mt-4 max-w-2xl">
                  <FormField label="Produto" htmlFor="pt-product" className="sm:col-span-2">
                    <select
                      id="pt-product"
                      className={fieldControlClass}
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                    >
                      <option value="">Selecione…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Preço (R$)" htmlFor="pt-price">
                    <Input
                      id="pt-price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                    />
                  </FormField>
                </FormGrid>
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!productId || !itemPrice || addItem.isPending}
                    onClick={() => addItem.mutate()}
                  >
                    Adicionar
                  </Button>
                </div>
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2">Produto</th>
                      <th className="pb-2">Preço</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((it) => (
                      <tr key={it.id} className="border-t border-border">
                        <td className="py-2">{it.product.name}</td>
                        <td>R$ {Number(it.price).toFixed(2)}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="text-destructive"
                            onClick={() => delItem.mutate({ tableId: selected.id, productId: it.productId })}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
