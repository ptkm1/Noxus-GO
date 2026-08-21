import type { CreatedPurchaseUnit } from "@/components/CreatePurchaseUnitSheet";
import { apiFetch } from "@/lib/api";
import {
  computeMarkupPercent,
  emptyProductForm,
  formToProductPayload,
  productToForm,
  validateProductForm,
  type ProductFormTab,
  type ProductFormValues,
  type ProductRecord,
} from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AttributeFieldDef } from "../components/DynamicCategoryAttributes";

export type CategoryBrief = {
  id: string;
  code: string;
  name: string;
  attributeSchema?: unknown;
};

export type SupplierBrief = {
  id: string;
  code: string;
  legalName: string;
  cnpj: string;
  tradeName: string;
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

export function useProductFormPage() {
  const { productId } = useParams<{ productId?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(productId);

  const [activeTab, setActiveTab] = useState<ProductFormTab>("principal");
  const [values, setValues] = useState<ProductFormValues>(emptyProductForm);
  const [attrs, setAttrs] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProductFormValues, string>>
  >({});
  const [selectedPriceTableId, setSelectedPriceTableId] = useState<string>("");
  const [priceTablePrices, setPriceTablePrices] = useState<
    Record<string, string>
  >({});
  const [addPriceTableId, setAddPriceTableId] = useState("");

  const setField = useCallback(
    <K extends keyof ProductFormValues>(
      key: K,
      value: ProductFormValues[K],
    ) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "product-categories"],
    queryFn: () => apiFetch<CategoryBrief[]>("/admin/product-categories"),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["admin", "suppliers"],
    queryFn: () => apiFetch<SupplierBrief[]>("/admin/suppliers"),
  });

  const { data: priceTables = [] } = useQuery({
    queryKey: ["admin", "price-tables"],
    queryFn: () =>
      apiFetch<Array<{ id: string; name: string }>>("/admin/price-tables"),
  });

  const { data: purchaseUnits = [] } = useQuery({
    queryKey: ["admin", "purchase-units"],
    queryFn: () =>
      apiFetch<Array<{ id: string; code: string; name: string }>>(
        "/admin/purchase-units",
      ),
  });

  const selectedDefs = useMemo(() => {
    const cat = categories.find((c) => c.id === values.categoryId);
    return coerceDefs(cat?.attributeSchema);
  }, [categories, values.categoryId]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === values.supplierId) ?? null,
    [suppliers, values.supplierId],
  );

  const {
    data: product,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin", "product", productId],
    queryFn: () => apiFetch<ProductRecord>(`/admin/products/${productId}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (product) {
      setValues(productToForm(product));
      setAttrs(normalizeAttrsJson(product.attributes));
      const items =
        (
          product as ProductRecord & {
            priceTableItems?: Array<{
              priceTableId: string;
              price: unknown;
            }>;
          }
        ).priceTableItems ?? [];
      const map: Record<string, string> = {};
      for (const item of items) {
        map[item.priceTableId] = String(Number(item.price));
      }
      setPriceTablePrices(map);
    }
  }, [product]);

  const markupPercent = useMemo(() => {
    const cost = values.costPrice.trim() ? Number(values.costPrice) : null;
    const sale = values.basePrice.trim() ? Number(values.basePrice) : 0;
    if (cost == null || Number.isNaN(cost) || Number.isNaN(sale)) return null;
    return computeMarkupPercent(cost, sale);
  }, [values.costPrice, values.basePrice]);

  const create = useMutation({
    mutationFn: (
      body: ReturnType<typeof formToProductPayload> & { priceTableId?: string },
    ) =>
      apiFetch<ProductRecord>("/admin/products", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      navigate("/produtos");
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const update = useMutation({
    mutationFn: (
      body: ReturnType<typeof formToProductPayload> & {
        priceTablePrices?: Array<{ priceTableId: string; price: number }>;
      },
    ) =>
      apiFetch<ProductRecord>(`/admin/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: ["admin", "product", productId] });
      await qc.invalidateQueries({ queryKey: ["admin", "price-tables"] });
      navigate("/produtos");
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const pending = create.isPending || update.isPending;

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);

      if (!isEdit && !selectedPriceTableId) {
        setActiveTab("precos");
        setFormError(
          "Na aba Preços, selecione a tabela em que o produto será cadastrado.",
        );
        return;
      }

      const validation = validateProductForm(values);
      if (!validation.ok) {
        setFieldErrors(validation.errors);
        if (validation.firstErrorTab) setActiveTab(validation.firstErrorTab);
        setFormError("Corrija os campos destacados antes de salvar.");
        return;
      }

      setFieldErrors({});
      try {
        const payload = formToProductPayload(values, attrs);
        if (isEdit) {
          const { stockQty: _stockQty, ...rest } = payload;
          const syncPrices = Object.entries(priceTablePrices)
            .filter(([, raw]) => raw.trim() !== "")
            .map(([priceTableId, raw]) => ({
              priceTableId,
              price: Number(raw),
            }))
            .filter((row) => !Number.isNaN(row.price) && row.price >= 0);
          update.mutate({
            ...(rest as typeof payload),
            ...(syncPrices.length > 0
              ? { priceTablePrices: syncPrices }
              : {}),
          });
        } else {
          create.mutate({
            ...payload,
            priceTableId: selectedPriceTableId,
          });
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    },
    [
      attrs,
      create,
      isEdit,
      priceTablePrices,
      selectedPriceTableId,
      update,
      values,
    ],
  );

  const onCategoryChange = useCallback(
    (nextId: string) => {
      const defs = coerceDefs(
        categories.find((c) => c.id === nextId)?.attributeSchema,
      );
      setField("categoryId", nextId);
      setAttrs((prev) => pruneAttrs(prev, defs));
    },
    [categories, setField],
  );

  const fieldError = useCallback(
    (key: keyof ProductFormValues) => fieldErrors[key],
    [fieldErrors],
  );

  const setPriceForTable = useCallback((tableId: string, price: string) => {
    setPriceTablePrices((prev) => ({ ...prev, [tableId]: price }));
  }, []);

  const addProductToPriceTable = useCallback(() => {
    if (!addPriceTableId) return;
    setPriceTablePrices((prev) => {
      if (prev[addPriceTableId] !== undefined) return prev;
      return {
        ...prev,
        [addPriceTableId]: values.basePrice || "0",
      };
    });
    setAddPriceTableId("");
  }, [addPriceTableId, values.basePrice]);

  const applyCreatedPriceTable = useCallback(
    (table: { id: string; name: string }) => {
      if (isEdit) {
        setPriceTablePrices((prev) => {
          if (prev[table.id] !== undefined) return prev;
          return {
            ...prev,
            [table.id]: values.basePrice || "0",
          };
        });
        setAddPriceTableId("");
        return;
      }
      setSelectedPriceTableId(table.id);
    },
    [isEdit, values.basePrice],
  );

  const applyCreatedPurchaseUnit = useCallback(
    (unit: CreatedPurchaseUnit) => {
      setField("purchaseUnit", unit.code);
    },
    [setField],
  );

  return {
    productId,
    isEdit,
    isLoading,
    isError,
    loadError: error,
    product,
    activeTab,
    setActiveTab,
    values,
    setField,
    attrs,
    setAttrs,
    formError,
    fieldErrors,
    fieldError,
    categories,
    suppliers,
    priceTables,
    purchaseUnits,
    applyCreatedPurchaseUnit,
    selectedDefs,
    selectedSupplier,
    markupPercent,
    handleSubmit,
    onCategoryChange,
    pending,
    selectedPriceTableId,
    setSelectedPriceTableId,
    priceTablePrices,
    setPriceForTable,
    addPriceTableId,
    setAddPriceTableId,
    addProductToPriceTable,
    applyCreatedPriceTable,
  };
}
