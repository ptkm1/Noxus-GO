import {
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { useConfirm } from "@/components/confirm";
import { ProductCombobox, ProductListCell } from "@/components/ProductCombobox";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  supplierId: string | null;
  basePrice: unknown;
};
type Category = { id: string; name: string };
type Supplier = { id: string; tradeName: string; legalName: string };
type Item = { id: string; productId: string; price: unknown; product: Product };
type PriceTable = {
  id: string;
  name: string;
  items: Item[];
  customer: { id: string; name: string } | null;
  seller: { id: string; user: { name: string } } | null;
  region: { id: string; code: string; name: string } | null;
};

function scopeLabel(table: PriceTable): string {
  if (table.customer) return `Cliente: ${table.customer.name}`;
  if (table.seller) return `Vendedor: ${table.seller.user.name}`;
  if (table.region) return `Região: ${table.region.name}`;
  return "Global";
}

export function PriceTablesPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["admin", "price-tables"],
    queryFn: () => apiFetch<PriceTable[]>("/admin/price-tables"),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiFetch<Product[]>("/admin/products"),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "product-categories"],
    queryFn: () => apiFetch<Category[]>("/admin/product-categories"),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["admin", "suppliers"],
    queryFn: () => apiFetch<Supplier[]>("/admin/suppliers"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [filterSupplierId, setFilterSupplierId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");

  const selectableProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterSupplierId && p.supplierId !== filterSupplierId) return false;
      if (filterCategoryId && p.categoryId !== filterCategoryId) return false;
      return true;
    });
  }, [products, filterSupplierId, filterCategoryId]);

  function resetCreateForm() {
    setName("");
  }

  function resetDetailForm() {
    setProductId("");
    setItemPrice("");
    setFilterSupplierId("");
    setFilterCategoryId("");
  }

  function openCreate() {
    resetCreateForm();
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    resetCreateForm();
  }

  function openDetail(table: PriceTable) {
    setSelectedId(table.id);
    resetDetailForm();
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
    setSelectedId(null);
    resetDetailForm();
  }

  const createTable = useMutation({
    mutationFn: () =>
      apiFetch<PriceTable>("/admin/price-tables", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      closeCreate();
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
      setProductId("");
    },
  });

  const delItem = useMutation({
    mutationFn: ({
      tableId,
      productId: pid,
    }: {
      tableId: string;
      productId: string;
    }) =>
      apiFetch(`/admin/price-tables/${tableId}/items/${pid}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] }),
  });

  const delTable = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/price-tables/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      if (selectedId === id) closeDetail();
    },
  });

  async function confirmDeleteTable(table: PriceTable) {
    const ok = await confirm({
      title: "Excluir tabela?",
      description: "A tabela de preços e todos os itens serão removidos.",
      confirmLabel: "Excluir",
      tone: "destructive",
    });
    if (ok) delTable.mutate(table.id);
  }

  const selected = tables.find((t) => t.id === selectedId);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Tabelas de preço
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Gerencie tabelas de preço e os produtos de cada uma.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Nova tabela
        </Button>
      </div>

      <FormSheet
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) closeCreate();
          else setCreateOpen(true);
        }}
        title="Nova tabela"
        description="Crie uma tabela de preço para depois adicionar produtos."
        footer={
          <FormSheetActions
            onCancel={closeCreate}
            onSubmit={() => {
              if (name) createTable.mutate();
            }}
            submitLabel="Criar tabela"
            pending={createTable.isPending}
            disabled={!name}
          />
        }
      >
        <FormField label="Nome" htmlFor="pt-name" required>
          <Input
            id="pt-name"
            placeholder="Nome da nova tabela"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
      </FormSheet>

      <FormSheet
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) closeDetail();
          else setDetailOpen(true);
        }}
        title={selected?.name ?? "Tabela de preço"}
        description={
          selected
            ? `${scopeLabel(selected)} · ${selected.items.length} itens`
            : undefined
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={closeDetail}
              disabled={delTable.isPending}
            >
              Fechar
            </Button>
            {selected ? (
              <Button
                type="button"
                variant="destructive"
                disabled={delTable.isPending}
                onClick={() => void confirmDeleteTable(selected)}
              >
                Excluir tabela
              </Button>
            ) : null}
          </>
        }
      >
        {!selected ? (
          <p className="text-sm text-muted-foreground">
            Selecione uma tabela na lista.
          </p>
        ) : (
          <div className="space-y-4">
            <FormGrid cols={2} className="max-w-2xl">
              <FormField label="Fornecedor" htmlFor="pt-filter-supplier">
                <AppSelect
                  id="pt-filter-supplier"
                  value={filterSupplierId}
                  onValueChange={(v) => {
                    setFilterSupplierId(v);
                    setProductId("");
                  }}
                  emptyLabel="Todos"
                  options={suppliers.map((s) => ({
                    value: s.id,
                    label: s.tradeName || s.legalName,
                  }))}
                />
              </FormField>
              <FormField label="Grupo" htmlFor="pt-filter-category">
                <AppSelect
                  id="pt-filter-category"
                  value={filterCategoryId}
                  onValueChange={(v) => {
                    setFilterCategoryId(v);
                    setProductId("");
                  }}
                  emptyLabel="Todos"
                  options={categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />
              </FormField>
            </FormGrid>
            <FormGrid cols={3} className="max-w-2xl">
              <FormField
                label="Produto"
                htmlFor="pt-product"
                className="sm:col-span-2"
              >
                <ProductCombobox
                  id="pt-product"
                  value={productId}
                  products={selectableProducts}
                  emptyLabel="Limpar seleção"
                  placeholder="Buscar por nome ou código…"
                  searchPlaceholder="Nome, SKU ou código de barras…"
                  onValueChange={setProductId}
                />
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
            <div>
              <Button
                type="button"
                size="sm"
                disabled={!productId || !itemPrice || addItem.isPending}
                onClick={() => addItem.mutate()}
              >
                Adicionar
              </Button>
            </div>

            {selected.items.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                Nenhum produto nesta tabela ainda.
              </p>
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3">Produto</TableHead>
                      <TableHead className="px-3">Preço</TableHead>
                      <TableHead className="px-3 w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="px-3 py-2">
                          <ProductListCell product={it.product} />
                        </TableCell>
                        <TableCell className="px-3 tabular-nums">
                          R$ {Number(it.price).toFixed(2)}
                        </TableCell>
                        <TableCell className="px-3 text-right">
                          <button
                            type="button"
                            className="text-destructive hover:underline"
                            onClick={() =>
                              delItem.mutate({
                                tableId: selected.id,
                                productId: it.productId,
                              })
                            }
                          >
                            Remover
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </FormSheet>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : tables.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Nenhuma tabela de preço cadastrada ainda.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Tabela</TableHead>
                <TableHead className="px-4">Escopo</TableHead>
                <TableHead className="px-4">Itens</TableHead>
                <TableHead className="px-4 w-44" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="px-4 py-3 font-medium text-foreground">
                    {t.name}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {scopeLabel(t)}
                  </TableCell>
                  <TableCell className="px-4 py-3 tabular-nums text-muted-foreground">
                    {t.items.length}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="mr-3 text-primary hover:underline"
                      onClick={() => openDetail(t)}
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      className="text-destructive hover:underline"
                      onClick={() => void confirmDeleteTable(t)}
                    >
                      Excluir
                    </button>
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
