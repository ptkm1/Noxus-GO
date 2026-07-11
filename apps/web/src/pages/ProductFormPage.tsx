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
import { isProductFiscalReady } from "@pedidos/shared";

type FiscalNcm = { id: string; code: string; description: string };

type CategoryBrief = {
  id: string;
  code: string;
  name: string;
  attributeSchema?: unknown;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  imageUrl?: string | null;
  basePrice: unknown;
  commissionPercent?: unknown | null;
  categoryId?: string | null;
  attributes?: Record<string, unknown>;
  category?: CategoryBrief | null;
  ncmId?: string | null;
  fiscalOrigin?: number | null;
  fiscalGtin?: string | null;
  fiscalUnit?: string | null;
  fiscalCest?: string | null;
  fiscalDescription?: string | null;
};

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

export function ProductFormPage() {
  const { productId } = useParams<{ productId?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(productId);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [attrs, setAttrs] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [ncmId, setNcmId] = useState("");
  const [fiscalOrigin, setFiscalOrigin] = useState("0");
  const [fiscalGtin, setFiscalGtin] = useState("");
  const [fiscalUnit, setFiscalUnit] = useState("UN");
  const [fiscalCest, setFiscalCest] = useState("");
  const [fiscalDescription, setFiscalDescription] = useState("");

  const { data: ncms = [] } = useQuery({
    queryKey: ["admin", "fiscal", "ncm"],
    queryFn: () => apiFetch<FiscalNcm[]>("/admin/fiscal/ncm"),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "product-categories"],
    queryFn: () => apiFetch<CategoryBrief[]>("/admin/product-categories"),
  });

  const selectedDefs = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId);
    return coerceDefs(cat?.attributeSchema);
  }, [categories, categoryId]);

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
      setDescription(product.description ?? "");
      setImageUrl(product.imageUrl ?? "");
      setBasePrice(String(Number(product.basePrice)));
      setCommissionPercent(
        product.commissionPercent != null
          ? String(Number(product.commissionPercent))
          : "",
      );
      setCategoryId(product.categoryId ?? "");
      setAttrs(normalizeAttrsJson(product.attributes));
      setNcmId(product.ncmId ?? "");
      setFiscalOrigin(
        product.fiscalOrigin != null ? String(product.fiscalOrigin) : "0",
      );
      setFiscalGtin(product.fiscalGtin ?? "");
      setFiscalUnit(product.fiscalUnit ?? "UN");
      setFiscalCest(product.fiscalCest ?? "");
      setFiscalDescription(product.fiscalDescription ?? "");
    }
  }, [product]);

  const create = useMutation({
    meta: { inlineError: true },
    mutationFn: (body: {
      name: string;
      sku?: string;
      description?: string;
      imageUrl?: string | null;
      basePrice: number;
      categoryId?: string | null;
      commissionPercent?: number | null;
      attributes?: Record<string, unknown>;
      ncmId?: string | null;
      fiscalOrigin?: number | null;
      fiscalGtin?: string | null;
      fiscalUnit?: string | null;
      fiscalCest?: string | null;
      fiscalDescription?: string | null;
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
    meta: { inlineError: true },
    mutationFn: (body: {
      name: string;
      sku: string | null;
      description: string | null;
      imageUrl?: string | null;
      basePrice: number;
      categoryId?: string | null;
      commissionPercent?: number | null;
      attributes?: Record<string, unknown>;
      ncmId?: string | null;
      fiscalOrigin?: number | null;
      fiscalGtin?: string | null;
      fiscalUnit?: string | null;
      fiscalCest?: string | null;
      fiscalDescription?: string | null;
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
      return;
    }
    if (basePrice.trim() === "" || Number.isNaN(priceNum) || priceNum < 0) {
      setFormError("Informe um preço base válido (≥ 0).");
      return;
    }

    const cid = categoryId.trim() ? categoryId : null;
    const img = imageUrl.trim();
    const commissionRaw = commissionPercent.trim();
    const commissionNum = commissionRaw === "" ? null : Number(commissionRaw);
    if (
      commissionNum !== null &&
      (Number.isNaN(commissionNum) || commissionNum < 0 || commissionNum > 100)
    ) {
      setFormError("Informe uma comissão entre 0 e 100 %, ou deixe em branco.");
      return;
    }

    if (isEdit) {
      update.mutate({
        name: n,
        sku: sku.trim() ? sku.trim() : null,
        description: description.trim() ? description.trim() : null,
        imageUrl: img.length ? img : null,
        basePrice: priceNum,
        categoryId: cid,
        commissionPercent: commissionNum,
        attributes: attrs,
        ncmId: ncmId || null,
        fiscalOrigin: Number(fiscalOrigin),
        fiscalGtin: fiscalGtin.trim() || null,
        fiscalUnit: fiscalUnit.trim() || null,
        fiscalCest: fiscalCest.trim() || null,
        fiscalDescription: fiscalDescription.trim() || null,
      });
    } else {
      create.mutate({
        name: n,
        sku: sku.trim() || undefined,
        description: description.trim() || undefined,
        ...(img.length ? { imageUrl: img } : {}),
        basePrice: priceNum,
        categoryId: cid ?? undefined,
        ...(commissionNum !== null ? { commissionPercent: commissionNum } : {}),
        attributes: attrs,
        ncmId: ncmId || undefined,
        fiscalOrigin: Number(fiscalOrigin),
        fiscalGtin: fiscalGtin.trim() || undefined,
        fiscalUnit: fiscalUnit.trim() || undefined,
        fiscalCest: fiscalCest.trim() || undefined,
        fiscalDescription: fiscalDescription.trim() || undefined,
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

      <form onSubmit={(e) => void handleSubmit(e)}>
        <FormSection
          title="Dados do produto"
          description="Informação principal e categoria."
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
                placeholder="Ex.: Óleo 5W30"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </FormField>

            <FormField
              label="Categoria"
              htmlFor="prod-category"
              className="sm:col-span-2"
              hint={
                <>
                  O formulário abaixo adapta-se ao schema da categoria.
                  Configure em{" "}
                  <Link
                    to="/produtos/categorias"
                    className="text-primary hover:underline"
                  >
                    categorias de produto
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
                <option value="">Sem categoria</option>
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
                placeholder="Código opcional"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                autoComplete="off"
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

          <div className="border-t border-border/60 pt-4">
            <p className="mb-3 text-sm font-semibold">Cadastro fiscal (NF-e)</p>
            <FormGrid cols={3}>
              <FormField label="NCM" className="sm:col-span-2">
                <select
                  className={fieldControlClass}
                  value={ncmId}
                  onChange={(e) => setNcmId(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {ncms.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.code} — {n.description}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Origem">
                <Input value={fiscalOrigin} onChange={(e) => setFiscalOrigin(e.target.value)} />
              </FormField>
              <FormField label="Unidade fiscal">
                <Input value={fiscalUnit} onChange={(e) => setFiscalUnit(e.target.value)} />
              </FormField>
              <FormField label="GTIN">
                <Input value={fiscalGtin} onChange={(e) => setFiscalGtin(e.target.value)} />
              </FormField>
              <FormField label="CEST">
                <Input value={fiscalCest} onChange={(e) => setFiscalCest(e.target.value)} />
              </FormField>
              <FormField label="Descrição na nota" className="sm:col-span-2">
                <Input
                  value={fiscalDescription}
                  onChange={(e) => setFiscalDescription(e.target.value)}
                  placeholder="Opcional — usa nome do produto se vazio"
                />
              </FormField>
            </FormGrid>
            <p className="mt-2 text-xs text-muted-foreground">
              {isProductFiscalReady({
                ncmId: ncmId || null,
                fiscalOrigin: fiscalOrigin ? Number(fiscalOrigin) : null,
                fiscalUnit,
              })
                ? "Pronto para NF-e"
                : "Cadastro fiscal incompleto para emissão de nota"}
            </p>
          </div>

          <div className="border-t border-border/60 pt-4">
            <DynamicCategoryAttributes
              defs={selectedDefs}
              values={attrs}
              onChange={setAttrs}
            />
          </div>

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <FormActions>
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
        </FormSection>
      </form>

      {isEdit && productId ? (
        <ProductPromotionsPanel productId={productId} />
      ) : null}
    </div>
  );
}
