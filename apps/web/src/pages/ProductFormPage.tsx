import {
  FormActions,
  FormField,
  FormGrid,
  FormSection,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldControlClass } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DynamicCategoryAttributes,
  type AttributeFieldDef,
} from "../components/DynamicCategoryAttributes";
import { ProductPromotionsPanel } from "../components/ProductPromotionsPanel";
import { apiFetch } from "../lib/api";

type CategoryBrief = {
  id: string;
  code: string;
  name: string;
  attributeSchema?: unknown;
};

type SupplierBrief = {
  id: string;
  code: string;
  legalName: string;
  cnpj: string;
  tradeName: string;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode?: string | null;
  description: string | null;
  imageUrl?: string | null;
  basePrice: unknown;
  commissionPercent?: unknown | null;
  categoryId?: string | null;
  supplierId?: string | null;
  stockQty?: number;
  blockSaleWhenOutOfStock?: boolean;
  attributes?: Record<string, unknown>;
  category?: CategoryBrief | null;
  supplier?: SupplierBrief | null;
};

type FormTab = "dados" | "fornecedor";

function coerceDefs(raw: unknown): AttributeFieldDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean) as AttributeFieldDef[];
}

function pruneAttrs(
  attrs: Record<string, unknown>,
  defs: AttributeFieldDef[],
): Record<string, unknown> {
  const keys = new Set(defs.map((d) => d.key));
  const next: Record<string, unknown> = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(attrs, k)) next[k] = attrs[k];
  }
  return next;
}

function normalizeAttrsJson(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...(raw as Record<string, unknown>) };
}

function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function ProductFormPage() {
  const { productId } = useParams<{ productId?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(productId);

  const [activeTab, setActiveTab] = useState<FormTab>("dados");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [blockSaleWhenOutOfStock, setBlockSaleWhenOutOfStock] = useState(false);
  const [attrs, setAttrs] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "product-categories"],
    queryFn: () => apiFetch<CategoryBrief[]>("/admin/product-categories"),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["admin", "suppliers"],
    queryFn: () => apiFetch<SupplierBrief[]>("/admin/suppliers"),
  });

  const selectedDefs = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId);
    return coerceDefs(cat?.attributeSchema);
  }, [categories, categoryId]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [suppliers, supplierId],
  );

  const {
    data: product,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin", "product", productId],
    queryFn: () => apiFetch<Product>(`/admin/products/${productId}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku ?? "");
      setBarcode(product.barcode ?? "");
      setDescription(product.description ?? "");
      setImageUrl(product.imageUrl ?? "");
      setBasePrice(String(Number(product.basePrice)));
      setCommissionPercent(
        product.commissionPercent != null
          ? String(Number(product.commissionPercent))
          : "",
      );
      setCategoryId(product.categoryId ?? product.category?.id ?? "");
      setSupplierId(product.supplierId ?? product.supplier?.id ?? "");
      setStockQty(String(product.stockQty ?? 0));
      setBlockSaleWhenOutOfStock(product.blockSaleWhenOutOfStock ?? false);
      setAttrs(normalizeAttrsJson(product.attributes));
    }
  }, [product]);

  const create = useMutation({
    mutationFn: (body: {
      name: string;
      sku?: string;
      barcode?: string;
      description?: string;
      imageUrl?: string | null;
      basePrice: number;
      categoryId: string;
      supplierId: string;
      commissionPercent?: number | null;
      stockQty?: number;
      blockSaleWhenOutOfStock?: boolean;
      attributes?: Record<string, unknown>;
    }) =>
      apiFetch<Product>("/admin/products", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      navigate("/produtos");
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const update = useMutation({
    mutationFn: (body: {
      name: string;
      sku: string | null;
      barcode: string | null;
      description: string | null;
      imageUrl?: string | null;
      basePrice: number;
      categoryId: string;
      supplierId: string;
      commissionPercent?: number | null;
      stockQty?: number;
      blockSaleWhenOutOfStock?: boolean;
      attributes?: Record<string, unknown>;
    }) =>
      apiFetch<Product>(`/admin/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: ["admin", "product", productId] });
      navigate("/produtos");
    },
    onError: (e: Error) => setFormError(e.message),
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const n = name.trim();
    const priceNum = Number(basePrice);
    if (!n) {
      setFormError("Informe o nome do produto.");
      setActiveTab("dados");
      return;
    }
    if (basePrice.trim() === "" || Number.isNaN(priceNum) || priceNum < 0) {
      setFormError("Informe um preço base válido (≥ 0).");
      setActiveTab("dados");
      return;
    }

    const cid = categoryId.trim();
    if (!cid) {
      setFormError("Selecione o grupo de produtos.");
      setActiveTab("dados");
      return;
    }

    const sid = supplierId.trim();
    if (!sid) {
      setFormError("Selecione o fornecedor do produto.");
      setActiveTab("fornecedor");
      return;
    }

    const img = imageUrl.trim();
    const commissionRaw = commissionPercent.trim();
    const commissionNum = commissionRaw === "" ? null : Number(commissionRaw);
    if (
      commissionNum !== null &&
      (Number.isNaN(commissionNum) || commissionNum < 0 || commissionNum > 100)
    ) {
      setFormError("Informe uma comissão entre 0 e 100 %, ou deixe em branco.");
      setActiveTab("dados");
      return;
    }

    const stockNum = Number(stockQty);
    if (
      stockQty.trim() === "" ||
      Number.isNaN(stockNum) ||
      stockNum < 0 ||
      !Number.isInteger(stockNum)
    ) {
      setFormError("Informe um estoque válido (inteiro ≥ 0).");
      setActiveTab("dados");
      return;
    }

    const payload = {
      name: n,
      sku: sku.trim() ? sku.trim() : null,
      barcode: barcode.trim() ? barcode.trim() : null,
      description: description.trim() ? description.trim() : null,
      imageUrl: img.length ? img : null,
      basePrice: priceNum,
      categoryId: cid,
      supplierId: sid,
      commissionPercent: commissionNum,
      stockQty: stockNum,
      blockSaleWhenOutOfStock,
      attributes: attrs,
    };

    if (isEdit) {
      update.mutate(payload);
    } else {
      create.mutate({
        name: n,
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        description: description.trim() || undefined,
        ...(img.length ? { imageUrl: img } : {}),
        basePrice: priceNum,
        categoryId: cid,
        supplierId: sid,
        ...(commissionNum !== null ? { commissionPercent: commissionNum } : {}),
        stockQty: stockNum,
        blockSaleWhenOutOfStock,
        attributes: attrs,
      });
    }
  }

  const pending = create.isPending || update.isPending;

  if (isEdit && isLoading) {
    return (
      <div className="space-y-4">
        <Link to="/produtos" className="text-sm text-primary hover:underline">
          ← Voltar para produtos
        </Link>
        <p className="text-muted-foreground">Carregando produto…</p>
      </div>
    );
  }

  if (isEdit && (isError || !product)) {
    const msg =
      error instanceof Error ? error.message : "Produto não encontrado.";
    return (
      <div className="space-y-4">
        <Link to="/produtos" className="text-sm text-primary hover:underline">
          ← Voltar para produtos
        </Link>
        <p className="text-destructive">{msg}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link to="/produtos" className="text-sm text-primary hover:underline">
          ← Voltar para produtos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {isEdit ? "Editar produto" : "Novo produto"}
        </h1>
        {isEdit && product ? (
          <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "dados"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("dados")}
        >
          Dados
        </button>
        <button
          type="button"
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "fornecedor"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("fornecedor")}
        >
          Fornecedor
          {selectedSupplier ? (
            <span className="ml-2 text-xs text-muted-foreground">
              ({selectedSupplier.tradeName})
            </span>
          ) : null}
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        {activeTab === "dados" ? (
          <FormSection
            title="Dados do produto"
            description="Informação principal e grupo de produtos."
          >
            <FormGrid cols={2}>
              <FormField
                label="Nome"
                htmlFor="prod-name"
                required
                className="sm:col-span-2"
              >
                <Input
                  id="prod-name"
                  placeholder="Ex.: Pimentinha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </FormField>

              <FormField
                label="Grupo de produtos"
                htmlFor="prod-category"
                required
                className="sm:col-span-2"
                hint={
                  <>
                    O formulário abaixo adapta-se ao schema do grupo. Configure
                    em{" "}
                    <Link
                      to="/produtos/categorias"
                      className="text-primary hover:underline"
                    >
                      grupos de produto
                    </Link>
                    .
                  </>
                }
              >
                <select
                  id="prod-category"
                  className={fieldControlClass}
                  value={categoryId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const defs = coerceDefs(
                      categories.find((c) => c.id === nextId)?.attributeSchema,
                    );
                    setCategoryId(nextId);
                    setAttrs((prev) => pruneAttrs(prev, defs));
                  }}
                >
                  <option value="">Selecione um grupo…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="SKU" htmlFor="prod-sku">
                <Input
                  id="prod-sku"
                  placeholder="Código interno opcional"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  autoComplete="off"
                />
              </FormField>

              <FormField
                label="Código de barras"
                htmlFor="prod-barcode"
                hint="EAN/GTIN usado pelo leitor na venda rápida do app."
              >
                <Input
                  id="prod-barcode"
                  placeholder="7891234567890"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  autoComplete="off"
                  inputMode="numeric"
                />
              </FormField>

              <FormField
                label="Preço base (R$)"
                htmlFor="prod-price"
                required
                hint="Usado quando não há preço em tabela de preços."
              >
                <Input
                  id="prod-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
              </FormField>

              <FormField
                label="Comissão do vendedor (%)"
                htmlFor="prod-commission"
                hint="Usado quando o vendedor é comissionado por produto. Deixe em branco se não aplicável."
              >
                <Input
                  id="prod-commission"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="Ex.: 8"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                />
              </FormField>

              <FormField
                label="Descrição"
                htmlFor="prod-desc"
                className="sm:col-span-2"
              >
                <Textarea
                  id="prod-desc"
                  rows={4}
                  placeholder="Detalhes do produto (opcional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </FormField>

              <FormField
                label="URL da foto (catálogo no app)"
                htmlFor="prod-image-url"
                className="sm:col-span-2"
                hint="Link público HTTPS — o vendedor vê esta foto no catálogo."
              >
                <Input
                  id="prod-image-url"
                  type="url"
                  placeholder="https://… (opcional)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  autoComplete="off"
                />
              </FormField>
            </FormGrid>

            <FormSection
              title="Estoque"
              description="Controle de quantidade disponível para venda."
              className="border-t border-border/60 pt-4"
            >
              <FormGrid cols={2}>
                <FormField
                  label="Quantidade em estoque"
                  htmlFor="prod-stock"
                  required
                >
                  <Input
                    id="prod-stock"
                    type="number"
                    min="0"
                    step="1"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Bloqueio de venda"
                  htmlFor="prod-block-stock"
                  className="sm:col-span-2"
                  hint="Quando ativo, impede venda se o estoque for zero ou insuficiente."
                >
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      id="prod-block-stock"
                      type="checkbox"
                      checked={blockSaleWhenOutOfStock}
                      onChange={(e) =>
                        setBlockSaleWhenOutOfStock(e.target.checked)
                      }
                    />
                    Bloquear venda quando estoque = 0
                  </label>
                </FormField>
              </FormGrid>
            </FormSection>

            <div className="border-t border-border/60 pt-4">
              <DynamicCategoryAttributes
                defs={selectedDefs}
                values={attrs}
                onChange={setAttrs}
              />
            </div>
          </FormSection>
        ) : (
          <FormSection
            title="Fornecedor do produto"
            description="Selecione quem fornece este item. É obrigatório para salvar."
          >
            <p className="text-sm text-muted-foreground">
              Não encontrou?{" "}
              <Link to="/fornecedores" className="text-primary hover:underline">
                Cadastrar fornecedor
              </Link>
            </p>

            {suppliers.length === 0 ? (
              <p className="mt-4 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                Nenhum fornecedor cadastrado. Cadastre um fornecedor antes de
                salvar o produto.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {suppliers.map((s) => {
                  const selected = s.id === supplierId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSupplierId(s.id)}
                        className={cn(
                          "w-full rounded-xl border p-4 text-left transition-colors",
                          selected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border bg-card hover:border-primary/30",
                        )}
                      >
                        <p className="font-semibold text-foreground">
                          {s.tradeName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {s.legalName}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Código: <span className="font-mono">{s.code}</span>
                          {" · "}
                          CNPJ: {formatCnpj(s.cnpj)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </FormSection>
        )}

        {formError ? (
          <p className="mt-4 text-sm text-destructive">{formError}</p>
        ) : null}

        <FormActions className="mt-6">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Salvando…"
              : isEdit
                ? "Salvar alterações"
                : "Criar produto"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/produtos">Cancelar</Link>
          </Button>
        </FormActions>
      </form>

      {isEdit && productId ? (
        <ProductPromotionsPanel productId={productId} />
      ) : null}
    </div>
  );
}
