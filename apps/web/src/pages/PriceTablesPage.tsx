import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
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
import { apiFetch } from "../lib/api";
import { confirmAction } from "../lib/app-notifications";

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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [itemPrice, setItemPrice] = useState("");

  function resetForm() {
    setName("");
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  const createTable = useMutation({
    mutationFn: () =>
      apiFetch<PriceTable>("/admin/price-tables", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      closeSheet();
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
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tabelas de preço</h1>
        <Button type="button" onClick={openCreate}>
          Nova tabela
        </Button>
      </div>

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title="Nova tabela"
        description="Crie uma tabela de preço para depois adicionar produtos."
        footer={
          <FormSheetActions
            onCancel={closeSheet}
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
                      void confirmAction({
                        title: "Excluir tabela?",
                        message: "Os itens desta tabela de preço serão removidos.",
                        confirmLabel: "Excluir",
                        variant: "destructive",
                      }).then((ok) => {
                        if (ok) delTable.mutate(t.id);
                      });
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
                    <AppSelect
                      id="pt-product"
                      value={productId}
                      emptyLabel="Selecione…"
                      placeholder="Selecione…"
                      options={products.map((p) => ({
                        value: p.id,
                        label: p.name,
                      }))}
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
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pb-2">Produto</TableHead>
                      <TableHead className="pb-2">Preço</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="py-2">{it.product.name}</TableCell>
                        <TableCell>R$ {Number(it.price).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            className="text-destructive"
                            onClick={() => delItem.mutate({ tableId: selected.id, productId: it.productId })}
                          >
                            Remover
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
