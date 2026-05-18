import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  imageUrl?: string | null;
  basePrice: unknown;
  category?: { id: string; code: string; name: string } | null;
};

export function ProductsPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiFetch<Product[]>("/admin/products"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "products"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Produtos</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/produtos/categorias"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Categorias
          </Link>
          <Link
            to="/produtos/novo"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Novo produto
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 w-16 hidden sm:table-cell">Foto</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3 hidden sm:table-cell">Categoria</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 hidden md:table-cell">Descrição</th>
                <th className="px-4 py-3">Preço base</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 hidden sm:table-cell align-middle">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-11 w-11 rounded-lg object-cover ring-1 ring-slate-200"
                        loading="lazy"
                      />
                    ) : (
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                    {p.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell max-w-[200px] truncate" title={p.description ?? undefined}>
                    {p.description?.trim() ? p.description : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">R$ {Number(p.basePrice).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      to={`/produtos/${p.id}/editar`}
                      className="text-brand-600 hover:text-brand-800 font-medium"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      className="ml-3 text-red-600 hover:text-red-800"
                      onClick={() => {
                        if (confirm("Excluir este produto? Esta ação não pode ser desfeita."))
                          remove.mutate(p.id);
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
