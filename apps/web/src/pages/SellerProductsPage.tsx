import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

type Product = { id: string; name: string };

export function SellerProductsPage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const qc = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiFetch<Product[]>("/admin/products"),
  });

  const { data: assigned = [], isLoading } = useQuery({
    queryKey: ["admin", "seller-products", sellerId],
    queryFn: () => apiFetch<Product[]>(`/admin/sellers/${sellerId}/products`),
    enabled: !!sellerId,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set(assigned.map((p) => p.id)));
  }, [assigned]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/sellers/${sellerId}/products`, {
        method: "PUT",
        body: JSON.stringify({ productIds: [...selected] }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "seller-products", sellerId] }),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  if (!sellerId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/vendedores" className="text-sm text-brand-600">
          ← Vendedores
        </Link>
        <h1 className="text-2xl font-semibold">Produtos liberados</h1>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : (
        <>
          <ul className="max-w-lg space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded bg-brand-600 px-4 py-2 text-sm text-white"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            Salvar liberações
          </button>
          <p className="text-xs text-slate-500">{selected.size} produto(s) selecionado(s).</p>
        </>
      )}
    </div>
  );
}
