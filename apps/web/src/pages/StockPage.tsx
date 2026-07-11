import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { STOCK_MOVEMENT_TYPE_LABELS } from "@pedidos/shared";
import type { StockMovementType } from "@pedidos/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormGrid, FormSection } from "@/components/forms";
import { fieldControlClass } from "@/lib/field-styles";
import { apiFetch } from "../lib/api";
import { notifySuccess } from "../lib/app-notifications";

const BALANCES_PAGE_SIZE = 20;
const MOVEMENTS_PAGE_SIZE = 15;

type StockRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  quantityOnHand: number;
};

type ProductOption = { id: string; name: string; sku: string | null };

type Movement = {
  id: string;
  type: StockMovementType;
  quantity: unknown;
  quantityAfter: unknown;
  notes: string | null;
  createdAt: string;
  product: { name: string; sku: string | null };
};

type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function PaginationBar({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{total} registro(s)</span>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Anterior
          </Button>
          <span>
            Página {page} de {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function StockPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [balancesPage, setBalancesPage] = useState(1);
  const [movementsPage, setMovementsPage] = useState(1);
  const [productId, setProductId] = useState("");
  const [movementType, setMovementType] = useState<StockMovementType>("MANUAL_IN");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setBalancesPage(1);
  }, [search]);

  const { data: productOptions = [] } = useQuery({
    queryKey: ["admin", "stock", "options"],
    queryFn: () => apiFetch<ProductOption[]>("/admin/stock/options"),
  });

  const { data: balances, isLoading } = useQuery({
    queryKey: ["admin", "stock", "balances", search, balancesPage],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(balancesPage),
        pageSize: String(BALANCES_PAGE_SIZE),
      });
      if (search.trim()) params.set("search", search.trim());
      return apiFetch<Paged<StockRow>>(`/admin/stock?${params}`);
    },
  });

  const { data: movementsPageData } = useQuery({
    queryKey: ["admin", "stock", "movements", movementsPage],
    queryFn: () =>
      apiFetch<Paged<Movement>>(
        `/admin/stock/movements?page=${movementsPage}&pageSize=${MOVEMENTS_PAGE_SIZE}`,
      ),
  });

  const rows = balances?.items ?? [];
  const movements = movementsPageData?.items ?? [];

  const createMovement = useMutation({
    mutationFn: () =>
      apiFetch<Movement>("/admin/stock/movements", {
        method: "POST",
        body: JSON.stringify({
          productId,
          type: movementType,
          quantity: Number(quantity),
          notes: notes.trim() || undefined,
        }),
      }),
    onSuccess: async (created) => {
      setQuantity("");
      setNotes("");
      qc.setQueryData<Paged<Movement>>(["admin", "stock", "movements", 1], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: [created, ...old.items].slice(0, MOVEMENTS_PAGE_SIZE),
          total: old.total + 1,
          totalPages: Math.max(1, Math.ceil((old.total + 1) / MOVEMENTS_PAGE_SIZE)),
        };
      });
      notifySuccess("Movimentação registrada.");
      await qc.refetchQueries({ queryKey: ["admin", "stock", "balances"] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Estoque</h1>

      <FormSection title="Lançamento manual">
        <FormGrid>
          <FormField label="Produto">
            <select
              className={fieldControlClass}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {productOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.sku ? `(${r.sku})` : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Tipo">
            <select
              className={fieldControlClass}
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as StockMovementType)}
            >
              <option value="MANUAL_IN">{STOCK_MOVEMENT_TYPE_LABELS.MANUAL_IN}</option>
              <option value="MANUAL_OUT">{STOCK_MOVEMENT_TYPE_LABELS.MANUAL_OUT}</option>
              <option value="MANUAL_ADJUST">{STOCK_MOVEMENT_TYPE_LABELS.MANUAL_ADJUST}</option>
            </select>
          </FormField>
          <FormField label={movementType === "MANUAL_ADJUST" ? "Novo saldo" : "Quantidade"}>
            <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </FormField>
          <FormField label="Observação">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </FormGrid>
        <Button
          className="mt-3"
          disabled={!productId || !quantity || createMovement.isPending}
          onClick={() => createMovement.mutate()}
        >
          Registrar movimentação
        </Button>
      </FormSection>

      <FormSection title="Saldos">
        <Input
          className="mb-3 max-w-sm"
          placeholder="Buscar produto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-background text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        Nenhum produto encontrado
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-4 py-3">{r.name}</td>
                        <td className="px-4 py-3">{r.sku ?? "—"}</td>
                        <td className="px-4 py-3">{r.category ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-medium">{r.quantityOnHand}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {balances ? (
              <PaginationBar
                page={balances.page}
                totalPages={balances.totalPages}
                total={balances.total}
                onPageChange={setBalancesPage}
              />
            ) : null}
          </>
        )}
      </FormSection>

      <FormSection title="Histórico">
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Qtd</th>
                <th className="px-4 py-3">Saldo após</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhuma movimentação
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3">{new Date(m.createdAt).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3">{m.product.name}</td>
                    <td className="px-4 py-3">{STOCK_MOVEMENT_TYPE_LABELS[m.type]}</td>
                    <td className="px-4 py-3">{Number(m.quantity)}</td>
                    <td className="px-4 py-3">{Number(m.quantityAfter)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {movementsPageData ? (
          <PaginationBar
            page={movementsPageData.page}
            totalPages={movementsPageData.totalPages}
            total={movementsPageData.total}
            onPageChange={setMovementsPage}
          />
        ) : null}
      </FormSection>
    </div>
  );
}
