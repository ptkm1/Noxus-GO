import { useConfirm } from "@/components/confirm";
import {
  FormErrorBanner,
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { ProductsHubNav } from "@/components/products/ProductsHubNav";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
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
import { useScrollToFirstError } from "@/hooks/useScrollToFirstError";
import { apiFetch } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type ProductOpt = {
  id: string;
  name: string;
  sku: string | null;
  basePrice: unknown;
};

type PromotionRow = {
  id: string;
  productId: string;
  kind: "PERCENT_OFF" | "FIXED_AMOUNT_OFF" | "SALE_PRICE";
  value: number;
  label: string | null;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    imageUrl: string | null;
    basePrice: number;
  };
};

function dateStartToIso(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const d = new Date(`${t}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function dateEndToIso(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const d = new Date(`${t}T23:59:59.999`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function formatMoney(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function kindShort(kind: PromotionRow["kind"], value: number): string {
  if (kind === "PERCENT_OFF") return `${value}% off`;
  if (kind === "FIXED_AMOUNT_OFF") return `− R$ ${formatMoney(value)}`;
  return `R$ ${formatMoney(value)}`;
}

function isCurrentlyActive(p: PromotionRow): boolean {
  if (!p.active) return false;
  const now = Date.now();
  if (p.validFrom && new Date(p.validFrom).getTime() > now) return false;
  if (p.validTo && new Date(p.validTo).getTime() < now) return false;
  return true;
}

export function ProductPromotionsPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionRow | null>(null);
  const [productId, setProductId] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ["admin", "promotions"],
    queryFn: () => apiFetch<PromotionRow[]>("/admin/promotions"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiFetch<ProductOpt[]>("/admin/products"),
  });

  function resetForm() {
    setEditing(null);
    setProductId("");
    setPromoPrice("");
    setValidFrom("");
    setValidTo("");
    setLabel("");
    setFormError(null);
    setShowValidation(false);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(row: PromotionRow) {
    setEditing(row);
    setProductId(row.productId);
    setPromoPrice(String(row.value));
    setValidFrom(isoToDateInput(row.validFrom));
    setValidTo(isoToDateInput(row.validTo));
    setLabel(row.label ?? "");
    setFormError(null);
    setShowValidation(false);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    resetForm();
  }

  const create = useMutation({
    meta: { inlineError: true },
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<PromotionRow>("/admin/promotions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
      closeSheet();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const update = useMutation({
    meta: { inlineError: true },
    mutationFn: (payload: {
      productId: string;
      promotionId: string;
      body: Record<string, unknown>;
    }) =>
      apiFetch(
        `/admin/products/${payload.productId}/promotions/${payload.promotionId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload.body),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
      closeSheet();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: (row: PromotionRow) =>
      apiFetch(`/admin/products/${row.productId}/promotions/${row.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
    },
  });

  const productOptions = useMemo(
    () =>
      [...products]
        .sort((a, b) => a.name.localeCompare(b.name, "pt"))
        .map((p) => ({
          value: p.id,
          label: p.sku ? `${p.name} (${p.sku})` : p.name,
        })),
    [products],
  );

  const saving = create.isPending || update.isPending;

  useScrollToFirstError(showValidation && Boolean(formError));

  function trySubmit() {
    setShowValidation(true);
    setFormError(null);

    if (!productId) {
      setFormError("Selecione um produto.");
      return;
    }
    const value = Number(promoPrice.replace(",", "."));
    if (Number.isNaN(value) || value < 0) {
      setFormError("Informe um preço promocional válido.");
      return;
    }
    if (!validFrom.trim() || !validTo.trim()) {
      setFormError("Informe data de início e data de fim.");
      return;
    }
    const vf = dateStartToIso(validFrom);
    const vt = dateEndToIso(validTo);
    if (!vf || !vt) {
      setFormError("Datas inválidas.");
      return;
    }
    if (new Date(vt).getTime() < new Date(vf).getTime()) {
      setFormError("A data fim deve ser igual ou posterior à data início.");
      return;
    }

    if (editing) {
      update.mutate({
        productId: editing.productId,
        promotionId: editing.id,
        body: {
          kind: editing.kind === "SALE_PRICE" ? "SALE_PRICE" : editing.kind,
          value,
          label: label.trim() || "Promoção",
          validFrom: vf,
          validTo: vt,
          active: true,
        },
      });
      return;
    }

    create.mutate({
      productId,
      scope: "PRODUCT_GLOBAL",
      kind: "SALE_PRICE",
      value,
      label: label.trim() || "Promoção",
      validFrom: vf,
      validTo: vt,
      active: true,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <ProductsHubNav />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Promoções
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Defina preço promocional e período. Produtos em promoção ativa
              também ficam em destaque no app de vendas. O preço de tabela /
              catálogo não é alterado — a promoção só entra no cálculo na venda.
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova promoção
        </Button>
      </div>

      {isLoading ? (
        <div className="surface-card h-40 animate-pulse bg-muted/50" />
      ) : promotions.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <Tag className="h-12 w-12 text-primary/40" />
          <p className="text-muted-foreground">Nenhuma promoção cadastrada.</p>
          <Button onClick={openCreate}>Criar primeira promoção</Button>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Preço promo</TableHead>
                <TableHead className="hidden md:table-cell">Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((p) => {
                const live = isCurrentlyActive(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.product.imageUrl?.trim() ? (
                          <img
                            src={p.product.imageUrl}
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
                            to={`/produtos/${p.productId}/editar`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {p.product.name}
                          </Link>
                          {p.label ? (
                            <p className="text-xs text-muted-foreground">
                              {p.label}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className="font-medium text-foreground">
                        {kindShort(p.kind, p.value)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Base R$ {formatMoney(p.product.basePrice)}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {formatDate(p.validFrom)} → {formatDate(p.validTo)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={live ? "default" : "secondary"}>
                        {live ? "Vigente" : p.active ? "Fora do período" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(p)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={remove.isPending}
                          onClick={() => {
                            void confirm({
                              title: "Excluir promoção?",
                              description:
                                "O preço de catálogo do produto não será alterado.",
                              confirmLabel: "Excluir",
                              tone: "destructive",
                            }).then((ok) => {
                              if (ok) remove.mutate(p);
                            });
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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
        title={editing ? "Editar promoção" : "Nova promoção"}
        description="Escolha o produto, o preço promocional e o período de validade."
        footer={
          <FormSheetActions
            onCancel={closeSheet}
            onSubmit={trySubmit}
            submitLabel={editing ? "Salvar" : "Criar promoção"}
            pending={saving}
          />
        }
      >
        {formError ? <FormErrorBanner message={formError} /> : null}
        <FormGrid>
          <FormField label="Produto" htmlFor="promo-product" required>
            <AppSelect
              id="promo-product"
              value={productId}
              onValueChange={setProductId}
              placeholder="Selecione…"
              options={productOptions}
              disabled={Boolean(editing)}
            />
          </FormField>
          <FormField
            label={
              editing && editing.kind !== "SALE_PRICE"
                ? "Valor da promoção"
                : "Preço promocional (R$)"
            }
            htmlFor="promo-price"
            required
          >
            <Input
              id="promo-price"
              inputMode="decimal"
              placeholder="0,00"
              value={promoPrice}
              onChange={(e) => setPromoPrice(e.target.value)}
            />
          </FormField>
          <FormField label="Data início" htmlFor="promo-from" required>
            <DatePicker
              id="promo-from"
              value={validFrom}
              onChange={setValidFrom}
            />
          </FormField>
          <FormField label="Data fim" htmlFor="promo-to" required>
            <DatePicker
              id="promo-to"
              value={validTo}
              onChange={setValidTo}
              min={validFrom || undefined}
            />
          </FormField>
          <FormField label="Rótulo (opcional)" htmlFor="promo-label">
            <Input
              id="promo-label"
              placeholder="Ex.: Oferta da semana"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </FormField>
        </FormGrid>
      </FormSheet>
    </div>
  );
}
