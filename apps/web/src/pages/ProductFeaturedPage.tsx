import { ProductsHubNav } from "@/components/products/ProductsHubNav";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  featured: boolean;
  basePrice: unknown;
  category?: { id: string; name: string } | null;
  imageUrl?: string | null;
};

export function ProductFeaturedPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiFetch<ProductRow[]>("/admin/products"),
  });

  const toggle = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      apiFetch(`/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ featured }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const list = text
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(text) ||
            (p.sku ?? "").toLowerCase().includes(text),
        )
      : products;
    return [...list].sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name, "pt");
    });
  }, [products, q]);

  const featuredCount = products.filter((p) => p.featured).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <ProductsHubNav />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Destaques
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Produtos marcados aparecem primeiro e em evidência no app de
              vendas, para os vendedores priorizarem essas ofertas.
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to="/produtos">Voltar ao catálogo</Link>
        </Button>
      </div>

      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Carregando…"
            : `${featuredCount} produto(s) em destaque`}
        </p>
        <Input
          className="sm:max-w-xs"
          placeholder="Buscar por nome ou SKU"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="surface-card h-40 animate-pulse bg-muted/50" />
      ) : filtered.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <Package className="h-12 w-12 text-primary/40" />
          <p className="text-muted-foreground">Nenhum produto encontrado.</p>
          <Button asChild>
            <Link to="/produtos/novo">Cadastrar produto</Link>
          </Button>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Destaque</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="hidden sm:table-cell">Grupo</TableHead>
                <TableHead className="text-right">Preço base</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={p.featured}
                        disabled={toggle.isPending}
                        onCheckedChange={(checked) => {
                          toggle.mutate({
                            id: p.id,
                            featured: checked === true,
                          });
                        }}
                        aria-label={
                          p.featured
                            ? `Remover ${p.name} dos destaques`
                            : `Marcar ${p.name} como destaque`
                        }
                      />
                      {p.featured ? (
                        <Star
                          className="h-4 w-4 fill-amber-400 text-amber-500"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.imageUrl?.trim() ? (
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <Link
                          to={`/produtos/${p.id}/editar`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.sku ? (
                          <p className="text-xs text-muted-foreground">
                            SKU {p.sku}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {p.category?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    R${" "}
                    {Number(p.basePrice).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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
