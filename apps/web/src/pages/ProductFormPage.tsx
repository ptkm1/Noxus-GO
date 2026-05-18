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

type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  imageUrl?: string | null;
  basePrice: unknown;
  categoryId?: string | null;
  attributes?: Record<string, unknown>;
  category?: CategoryBrief | null;
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
  const [categoryId, setCategoryId] = useState("");
  const [attrs, setAttrs] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState<string | null>(null);

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
      setCategoryId(product.categoryId ?? "");
      setAttrs(normalizeAttrsJson(product.attributes));
    }
  }, [product]);

  const create = useMutation({
    mutationFn: (body: {
      name: string;
      sku?: string;
      description?: string;
      imageUrl?: string | null;
      basePrice: number;
      categoryId?: string | null;
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
      description: string | null;
      imageUrl?: string | null;
      basePrice: number;
      categoryId?: string | null;
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
      return;
    }
    if (basePrice.trim() === "" || Number.isNaN(priceNum) || priceNum < 0) {
      setFormError("Informe um preço base válido (≥ 0).");
      return;
    }

    const cid = categoryId.trim() ? categoryId : null;
    const img = imageUrl.trim();

    if (isEdit) {
      update.mutate({
        name: n,
        sku: sku.trim() ? sku.trim() : null,
        description: description.trim() ? description.trim() : null,
        imageUrl: img.length ? img : null,
        basePrice: priceNum,
        categoryId: cid,
        attributes: attrs,
      });
    } else {
      create.mutate({
        name: n,
        sku: sku.trim() || undefined,
        description: description.trim() || undefined,
        ...(img.length ? { imageUrl: img } : {}),
        basePrice: priceNum,
        categoryId: cid ?? undefined,
        attributes: attrs,
      });
    }
  }

  const pending = create.isPending || update.isPending;

  if (isEdit && isLoading) {
    return (
      <div className="space-y-4">
        <Link to="/produtos" className="text-sm text-brand-600 hover:underline">
          ← Voltar para produtos
        </Link>
        <p className="text-slate-600">Carregando produto…</p>
      </div>
    );
  }

  if (isEdit && (isError || !product)) {
    const msg =
      error instanceof Error ? error.message : "Produto não encontrado.";
    return (
      <div className="space-y-4">
        <Link to="/produtos" className="text-sm text-brand-600 hover:underline">
          ← Voltar para produtos
        </Link>
        <p className="text-red-600">{msg}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link to="/produtos" className="text-sm text-brand-600 hover:underline">
          ← Voltar para produtos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {isEdit ? "Editar produto" : "Novo produto"}
        </h1>
        {isEdit && product ? (
          <p className="mt-1 text-sm text-slate-500">{product.name}</p>
        ) : null}
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-1.5">
          <label htmlFor="prod-name" className="block text-sm font-medium text-slate-700">
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            id="prod-name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="Ex.: Óleo 5W30"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="prod-category" className="block text-sm font-medium text-slate-700">
            Categoria
          </label>
          <select
            id="prod-category"
            className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
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
          <p className="text-xs text-slate-500">
            O formulário abaixo se adapta ao schema da categoria. Configure em{" "}
            <Link to="/produtos/categorias" className="text-brand-600 hover:underline">
              categorias de produto
            </Link>
            .
          </p>
        </div>

        <DynamicCategoryAttributes defs={selectedDefs} values={attrs} onChange={setAttrs} />

        <div className="space-y-1.5">
          <label htmlFor="prod-sku" className="block text-sm font-medium text-slate-700">
            SKU
          </label>
          <input
            id="prod-sku"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="Código opcional"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="prod-desc" className="block text-sm font-medium text-slate-700">
            Descrição
          </label>
          <textarea
            id="prod-desc"
            rows={4}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="Detalhes do produto (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="prod-image-url" className="block text-sm font-medium text-slate-700">
            URL da foto (catálogo no app)
          </label>
          <input
            id="prod-image-url"
            type="url"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="https://… (opcional)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-slate-500">
            Cole um link público direto para a imagem (HTTPS). O vendedor vê esta foto grande no catálogo.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="prod-price" className="block text-sm font-medium text-slate-700">
            Preço base (R$) <span className="text-red-500">*</span>
          </label>
          <input
            id="prod-price"
            type="number"
            step="0.01"
            min="0"
            className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="0,00"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            Usado quando não há preço específico em tabela de preços.
          </p>
        </div>

        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar produto"}
          </button>
          <Link
            to="/produtos"
            className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>

      {isEdit && productId ? <ProductPromotionsPanel productId={productId} /> : null}
    </div>
  );
}
