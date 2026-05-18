import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Nome da nova tabela"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-brand-600 px-4 py-2 text-sm text-white"
          onClick={() => name && createTable.mutate()}
          disabled={!name || createTable.isPending}
        >
          Criar tabela
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 font-medium">Tabelas</div>
            <ul className="divide-y divide-slate-100">
              {tables.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-2">
                  <button
                    type="button"
                    className={`text-left text-sm ${selectedId === t.id ? "font-semibold text-brand-700" : ""}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    {t.name} <span className="text-slate-400">({t.items.length} itens)</span>
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-600"
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

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {!selected ? (
              <p className="text-sm text-slate-500">Selecione uma tabela.</p>
            ) : (
              <>
                <h2 className="font-medium">{selected.name}</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">Produto…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="w-28 rounded border px-2 py-1 text-sm"
                    placeholder="Preço"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded bg-slate-800 px-3 py-1 text-sm text-white"
                    disabled={!productId || !itemPrice || addItem.isPending}
                    onClick={() => addItem.mutate()}
                  >
                    Adicionar
                  </button>
                </div>
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2">Produto</th>
                      <th className="pb-2">Preço</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((it) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="py-2">{it.product.name}</td>
                        <td>R$ {Number(it.price).toFixed(2)}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="text-red-600"
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
