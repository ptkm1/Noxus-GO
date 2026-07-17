import {
  ProductListCell,
  matchesProductQuery,
  type ProductComboboxItem,
} from "@/components/ProductCombobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCheck, Package, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

type Product = ProductComboboxItem;

type Seller = {
  id: string;
  user: { name: string; email: string };
};

type FilterMode = "all" | "assigned" | "available";

export function SellerProductsPage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [baseline, setBaseline] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiFetch<Product[]>("/admin/products"),
  });

  const { data: assigned = [], isLoading: assignedLoading } = useQuery({
    queryKey: ["admin", "seller-products", sellerId],
    queryFn: () => apiFetch<Product[]>(`/admin/sellers/${sellerId}/products`),
    enabled: !!sellerId,
  });

  const isLoading = productsLoading || assignedLoading;
  const seller = sellers.find((s) => s.id === sellerId);

  useEffect(() => {
    const ids = new Set(assigned.map((p) => p.id));
    setSelected(ids);
    setBaseline(ids);
  }, [assigned]);

  const dirty = useMemo(() => {
    if (selected.size !== baseline.size) return true;
    for (const id of selected) {
      if (!baseline.has(id)) return true;
    }
    return false;
  }, [selected, baseline]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (!matchesProductQuery(p, query)) return false;
      const isOn = selected.has(p.id);
      if (filter === "assigned") return isOn;
      if (filter === "available") return !isOn;
      return true;
    });
  }, [products, query, filter, selected]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/sellers/${sellerId}/products`, {
        method: "PUT",
        body: JSON.stringify({ productIds: [...selected] }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["admin", "seller-products", sellerId],
      });
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of filtered) next.add(p.id);
      return next;
    });
  }

  function clearFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of filtered) next.delete(p.id);
      return next;
    });
  }

  function discardChanges() {
    setSelected(new Set(baseline));
  }

  if (!sellerId) return null;

  const filterTabs: Array<{ value: FilterMode; label: string }> = [
    { value: "all", label: `Todos (${products.length})` },
    { value: "assigned", label: `Liberados (${selected.size})` },
    {
      value: "available",
      label: `Disponíveis (${Math.max(0, products.length - selected.size)})`,
    },
  ];

  const listContent = (() => {
    if (isLoading) {
      return (
        <div className="grid gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="surface-card h-16 animate-pulse bg-muted/50"
            />
          ))}
        </div>
      );
    }
    if (products.length === 0) {
      return (
        <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <Package className="size-12 text-primary/40" />
          <p className="text-muted-foreground">Nenhum produto no catálogo.</p>
          <Button variant="outline" asChild>
            <Link to="/produtos/novo">Cadastrar produto</Link>
          </Button>
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <div className="surface-card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum produto corresponde à busca ou ao filtro.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Limpar filtros
          </Button>
        </div>
      );
    }
    return (
      <ul className="surface-card divide-y divide-border overflow-hidden">
        {filtered.map((product) => {
          const checked = selected.has(product.id);
          const inputId = `seller-product-${product.id}`;
          return (
            <li key={product.id}>
              <label
                htmlFor={inputId}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                  "hover:bg-accent/40",
                  checked && "bg-primary/5",
                )}
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  onCheckedChange={() => toggle(product.id)}
                  aria-label={`Liberar ${product.name}`}
                />
                <div className="min-w-0 flex-1">
                  <ProductListCell product={product} />
                </div>
                {checked ? (
                  <Badge
                    variant="secondary"
                    className="hidden shrink-0 sm:inline-flex"
                  >
                    Liberado
                  </Badge>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
    );
  })();

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link to="/vendedores">
              <ArrowLeft className="size-4" />
              Vendedores
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Produtos liberados
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {seller
                ? `Catálogo disponível para ${seller.user.name}`
                : "Defina quais produtos este vendedor pode vender"}
            </p>
            {seller ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {seller.user.email}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <Badge variant="secondary" className="font-normal">
              Alterações não salvas
            </Badge>
          ) : null}
          <Badge variant="outline" className="font-normal tabular-nums">
            {selected.size} / {products.length} liberados
          </Badge>
        </div>
      </div>

      <div className="surface-card space-y-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, SKU ou código…"
            className="pl-9"
            aria-label="Buscar produtos"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAllFiltered}
              disabled={filtered.length === 0}
            >
              <CheckCheck className="size-4" />
              Liberar filtrados
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFiltered}
              disabled={filtered.length === 0}
            >
              <X className="size-4" />
              Remover filtrados
            </Button>
          </div>
        </div>
      </div>

      {listContent}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 lg:left-64">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {selected.size}
            </span>{" "}
            produto{selected.size === 1 ? "" : "s"} liberado
            {selected.size === 1 ? "" : "s"}
            {dirty ? " · há alterações pendentes" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || save.isPending}
              onClick={discardChanges}
            >
              Descartar
            </Button>
            <Button
              type="button"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Salvando…" : "Salvar liberações"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
