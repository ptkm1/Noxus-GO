import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { ProductCard, type ProductCardItem } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function ProductsPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiFetch<ProductCardItem[]>("/admin/products"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "products"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${products.length} produto(s) no catálogo`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/produtos/categorias">Categorias</Link>
          </Button>
          <Button asChild>
            <Link to="/produtos/novo">Novo produto</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="surface-card h-44 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <Package className="h-12 w-12 text-primary/40" />
          <p className="text-muted-foreground">Nenhum produto cadastrado.</p>
          <Button asChild>
            <Link to="/produtos/novo">Criar primeiro produto</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onDelete={() => {
                if (confirm("Excluir este produto? Esta ação não pode ser desfeita.")) {
                  remove.mutate(p.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
