import { useAuth } from "@/auth/AuthContext";
import { ProductListCell } from "@/components/ProductCombobox";
import {
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type StockLot = {
  id: string;
  lotCode: string;
  expiresAt: string;
  qty: number;
};

type StockProduct = {
  id: string;
  name: string;
  sku: string | null;
  imageUrl?: string | null;
  stockQty: number;
  hasExpiringSoon: boolean;
  expiringLotsCount: number;
  category: { id: string; name: string } | null;
  supplier: { id: string; tradeName: string } | null;
  lots: StockLot[];
};

type Category = { id: string; name: string };
type Supplier = { id: string; tradeName: string; legalName: string };

type EntryType = "MANUAL_IN" | "MANUAL_OUT" | "ADJUST";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function StockPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(
    null,
  );
  const [entryType, setEntryType] = useState<EntryType>("MANUAL_IN");
  const [qty, setQty] = useState("1");
  const [lotCode, setLotCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (supplierId) p.set("supplierId", supplierId);
    if (categoryId) p.set("categoryId", categoryId);
    if (q.trim()) p.set("q", q.trim());
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [supplierId, categoryId, q]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin", "stock", supplierId, categoryId, q],
    queryFn: () => apiFetch<StockProduct[]>(`/admin/stock${queryParams}`),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "product-categories"],
    queryFn: () => apiFetch<Category[]>("/admin/product-categories"),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["admin", "suppliers"],
    queryFn: () => apiFetch<Supplier[]>("/admin/suppliers"),
  });

  function openEntry(product: StockProduct) {
    setSelectedProduct(product);
    setEntryType("MANUAL_IN");
    setQty("1");
    setLotCode("");
    setExpiresAt("");
    setReason("");
    setPassword("");
    setFormError(null);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setSelectedProduct(null);
    setFormError(null);
  }

  const entry = useMutation({
    mutationFn: () => {
      const qtyNum = Number(qty);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        throw new Error("Quantidade inválida");
      }
      return apiFetch("/admin/stock/entries", {
        method: "POST",
        body: JSON.stringify({
          productId: selectedProduct!.id,
          type: entryType,
          qty: qtyNum,
          lotCode,
          expiresAt: new Date(expiresAt).toISOString(),
          reason: reason.trim() || undefined,
          password,
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "stock"] });
      void qc.invalidateQueries({ queryKey: ["admin", "stock-movements"] });
      void qc.invalidateQueries({ queryKey: ["admin", "stock-expiring"] });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      closeSheet();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const canSubmit =
    Boolean(selectedProduct) &&
    Number.isFinite(Number(qty)) &&
    Number(qty) > 0 &&
    lotCode.trim() &&
    expiresAt &&
    password.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Estoque</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lotes, validade e entradas manuais com reautenticação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/estoque/movimentos">Histórico</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/insights">Validade &lt; 30 dias</Link>
          </Button>
        </div>
      </div>

      <div className="surface-card grid gap-3 p-4 sm:grid-cols-3">
        <FormField label="Fornecedor" htmlFor="stock-supplier">
          <AppSelect
            id="stock-supplier"
            value={supplierId}
            onValueChange={setSupplierId}
            emptyLabel="Todos"
            options={suppliers.map((s) => ({
              value: s.id,
              label: s.tradeName || s.legalName,
            }))}
          />
        </FormField>
        <FormField label="Grupo" htmlFor="stock-category">
          <AppSelect
            id="stock-category"
            value={categoryId}
            onValueChange={setCategoryId}
            emptyLabel="Todos"
            options={categories.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
          />
        </FormField>
        <FormField label="Buscar" htmlFor="stock-q">
          <Input
            id="stock-q"
            placeholder="Nome, SKU ou código de barras"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </FormField>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando estoque…</p>
      ) : products.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <Package className="h-12 w-12 text-primary/40" />
          <p className="text-muted-foreground">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Lotes / validade</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <ProductListCell product={p} />
                  </TableCell>
                  <TableCell>{p.category?.name ?? "—"}</TableCell>
                  <TableCell>{p.supplier?.tradeName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.stockQty}
                  </TableCell>
                  <TableCell>
                    {p.hasExpiringSoon ? (
                      <span
                        className={cn(
                          "mb-1 inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400",
                        )}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {p.expiringLotsCount} lote(s) &lt; 30 dias
                      </span>
                    ) : null}
                    {p.lots.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Sem lotes
                      </span>
                    ) : (
                      <ul className="space-y-0.5 text-sm">
                        {p.lots.slice(0, 3).map((l) => (
                          <li key={l.id}>
                            {l.lotCode} · {l.qty} un · {formatDate(l.expiresAt)}
                          </li>
                        ))}
                        {p.lots.length > 3 ? (
                          <li className="text-muted-foreground">
                            +{p.lots.length - 3} lote(s)
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openEntry(p)}
                    >
                      Movimentar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
          else setSheetOpen(true);
        }}
        title="Movimentação de estoque"
        description={
          selectedProduct
            ? `${selectedProduct.name} — saldo atual: ${selectedProduct.stockQty}`
            : undefined
        }
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={() => entry.mutate()}
            submitLabel="Confirmar"
            pending={entry.isPending}
            disabled={!canSubmit}
          />
        }
      >
        <FormGrid cols={2}>
          <FormField
            label="Tipo"
            htmlFor="stock-entry-type"
            className="sm:col-span-2"
          >
            <AppSelect
              id="stock-entry-type"
              value={entryType}
              onValueChange={(v) => setEntryType(v as EntryType)}
              options={[
                { value: "MANUAL_IN", label: "Entrada" },
                { value: "MANUAL_OUT", label: "Saída" },
                { value: "ADJUST", label: "Ajuste (definir qtd. do lote)" },
              ]}
            />
          </FormField>
          <FormField label="Quantidade" htmlFor="stock-qty" required>
            <Input
              id="stock-qty"
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </FormField>
          <FormField label="Lote" htmlFor="stock-lot" required>
            <Input
              id="stock-lot"
              value={lotCode}
              onChange={(e) => setLotCode(e.target.value)}
              placeholder="Ex.: L2026-01"
            />
          </FormField>
          <FormField label="Validade" htmlFor="stock-expires" required>
            <DatePicker
              id="stock-expires"
              value={expiresAt}
              onChange={setExpiresAt}
              placeholder="Validade do lote"
            />
          </FormField>
          <FormField
            label="Motivo"
            htmlFor="stock-reason"
            className="sm:col-span-2"
          >
            <Input
              id="stock-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Opcional"
            />
          </FormField>
          <div className="sm:col-span-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">Reautenticação</p>
            <p className="mt-1 text-muted-foreground">
              Usuário: {user?.email}
              {user?.matricula ? ` · Matrícula: ${user.matricula}` : ""}
            </p>
          </div>
          <FormField
            label="Senha"
            htmlFor="stock-password"
            required
            className="sm:col-span-2"
          >
            <Input
              id="stock-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Confirme sua senha"
            />
          </FormField>
          {formError ? (
            <p className="sm:col-span-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
        </FormGrid>
      </FormSheet>
    </div>
  );
}
