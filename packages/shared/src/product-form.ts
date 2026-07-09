export type ProductClassification =
  | "RESALE"
  | "RAW_MATERIAL"
  | "INTERNAL_USE"
  | "SERVICE"
  | "OTHER";

export const PRODUCT_CLASSIFICATIONS: ProductClassification[] = [
  "RESALE",
  "RAW_MATERIAL",
  "INTERNAL_USE",
  "SERVICE",
  "OTHER",
];

const CLASSIFICATION_LABELS: Record<ProductClassification, string> = {
  RESALE: "Produto para revenda",
  RAW_MATERIAL: "Matéria-prima",
  INTERNAL_USE: "Uso e consumo",
  SERVICE: "Serviço",
  OTHER: "Outro",
};

export function productClassificationLabel(
  value: ProductClassification,
): string {
  return CLASSIFICATION_LABELS[value];
}

export const PURCHASE_UNITS = [
  { value: "UN", label: "Unidade (UN)" },
  { value: "CX", label: "Caixa (CX)" },
  { value: "FD", label: "Fardo (FD)" },
  { value: "KG", label: "Quilograma (KG)" },
  { value: "L", label: "Litro (L)" },
] as const;

export type ProductFormTab =
  | "principal"
  | "precos"
  | "comissoes"
  | "estoque"
  | "fiscal"
  | "fornecedor"
  | "atributos";

export type ProductFormValues = {
  name: string;
  sku: string;
  barcode: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  productLine: string;
  productClassification: ProductClassification | "";
  basePrice: string;
  costPrice: string;
  factoryPrice: string;
  maxSalePrice: string;
  minSaleUnitPrice: string;
  maxSellerDiscountPercent: string;
  freightAmount: string;
  commissionPercent: string;
  collectionCommissionPercent: string;
  stockQty: string;
  minStockQty: string;
  maxStockQty: string;
  blockSaleWhenOutOfStock: boolean;
  stockAddress: string;
  purchaseUnit: string;
  standardPurchaseBoxQty: string;
  grossWeightKg: string;
  netWeightKg: string;
  maxDailyQtyPerSeller: string;
  maxDailyQtyPerCustomer: string;
  ncm: string;
  ncmException: string;
  nfeOrigin: string;
  fiscalClass: string;
  pisCofinsClassification: string;
  cstPis: string;
  ipiPercent: string;
  icmsCostPercent: string;
  cbsIbsClassification: string;
  supplierId: string;
};

export type ProductFormErrors = Partial<
  Record<keyof ProductFormValues, string>
> & {
  _form?: string;
};

export type ProductFormValidation = {
  ok: boolean;
  errors: ProductFormErrors;
  firstErrorTab?: ProductFormTab;
};

export type ProductRecord = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  basePrice: unknown;
  costPrice?: unknown | null;
  factoryPrice?: unknown | null;
  maxSalePrice?: unknown | null;
  minSaleUnitPrice?: unknown | null;
  maxSellerDiscountPercent?: unknown | null;
  freightAmount?: unknown | null;
  commissionPercent?: unknown | null;
  collectionCommissionPercent?: unknown | null;
  categoryId?: string | null;
  productLine?: string | null;
  productClassification?: ProductClassification | null;
  supplierId?: string | null;
  stockQty?: number;
  minStockQty?: number;
  maxStockQty?: number | null;
  blockSaleWhenOutOfStock?: boolean;
  stockAddress?: string | null;
  purchaseUnit?: string | null;
  standardPurchaseBoxQty?: number | null;
  grossWeightKg?: unknown | null;
  netWeightKg?: unknown | null;
  maxDailyQtyPerSeller?: number | null;
  maxDailyQtyPerCustomer?: number | null;
  ncm?: string | null;
  ncmException?: string | null;
  nfeOrigin?: number | null;
  fiscalClass?: string | null;
  pisCofinsClassification?: string | null;
  cstPis?: string | null;
  ipiPercent?: unknown | null;
  icmsCostPercent?: unknown | null;
  cbsIbsClassification?: string | null;
  attributes?: Record<string, unknown>;
  createdAt?: string;
  category?: { id: string } | null;
  supplier?: { id: string } | null;
};

function numStr(v: unknown | null | undefined): string {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isNaN(n) ? "" : String(n);
}

function intStr(v: number | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

export function emptyProductForm(): ProductFormValues {
  return {
    name: "",
    sku: "",
    barcode: "",
    description: "",
    imageUrl: "",
    categoryId: "",
    productLine: "",
    productClassification: "",
    basePrice: "",
    costPrice: "",
    factoryPrice: "",
    maxSalePrice: "",
    minSaleUnitPrice: "",
    maxSellerDiscountPercent: "",
    freightAmount: "",
    commissionPercent: "",
    collectionCommissionPercent: "",
    stockQty: "0",
    minStockQty: "0",
    maxStockQty: "",
    blockSaleWhenOutOfStock: false,
    stockAddress: "",
    purchaseUnit: "",
    standardPurchaseBoxQty: "",
    grossWeightKg: "",
    netWeightKg: "",
    maxDailyQtyPerSeller: "",
    maxDailyQtyPerCustomer: "",
    ncm: "",
    ncmException: "",
    nfeOrigin: "",
    fiscalClass: "",
    pisCofinsClassification: "",
    cstPis: "",
    ipiPercent: "",
    icmsCostPercent: "",
    cbsIbsClassification: "",
    supplierId: "",
  };
}

export function productToForm(p: ProductRecord): ProductFormValues {
  const attrs = p.attributes ?? {};
  const attrNcm = typeof attrs.ncm === "string" ? attrs.ncm : "";
  return {
    name: p.name ?? "",
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    description: p.description ?? "",
    imageUrl: p.imageUrl ?? "",
    categoryId: p.categoryId ?? p.category?.id ?? "",
    productLine: p.productLine ?? "",
    productClassification: p.productClassification ?? "",
    basePrice: numStr(p.basePrice),
    costPrice: numStr(p.costPrice),
    factoryPrice: numStr(p.factoryPrice),
    maxSalePrice: numStr(p.maxSalePrice),
    minSaleUnitPrice: numStr(p.minSaleUnitPrice),
    maxSellerDiscountPercent: numStr(p.maxSellerDiscountPercent),
    freightAmount: numStr(p.freightAmount),
    commissionPercent: numStr(p.commissionPercent),
    collectionCommissionPercent: numStr(p.collectionCommissionPercent),
    stockQty: intStr(p.stockQty ?? 0),
    minStockQty: intStr(p.minStockQty ?? 0),
    maxStockQty: intStr(p.maxStockQty),
    blockSaleWhenOutOfStock: p.blockSaleWhenOutOfStock ?? false,
    stockAddress: p.stockAddress ?? "",
    purchaseUnit: p.purchaseUnit ?? "",
    standardPurchaseBoxQty: intStr(p.standardPurchaseBoxQty),
    grossWeightKg: numStr(p.grossWeightKg),
    netWeightKg: numStr(p.netWeightKg),
    maxDailyQtyPerSeller: intStr(p.maxDailyQtyPerSeller),
    maxDailyQtyPerCustomer: intStr(p.maxDailyQtyPerCustomer),
    ncm: p.ncm ?? attrNcm,
    ncmException: p.ncmException ?? "",
    nfeOrigin: p.nfeOrigin != null ? String(p.nfeOrigin) : "",
    fiscalClass: p.fiscalClass ?? "",
    pisCofinsClassification: p.pisCofinsClassification ?? "",
    cstPis: p.cstPis ?? "",
    ipiPercent: numStr(p.ipiPercent),
    icmsCostPercent: numStr(p.icmsCostPercent),
    cbsIbsClassification: p.cbsIbsClassification ?? "",
    supplierId: p.supplierId ?? p.supplier?.id ?? "",
  };
}

export function normalizeNcm(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

export function isNcmComplete(ncm: string): boolean {
  return normalizeNcm(ncm).length === 8;
}

export function computeMarkupPercent(
  costPrice: number | null,
  basePrice: number,
): number | null {
  if (costPrice == null || costPrice <= 0) return null;
  return ((basePrice - costPrice) / costPrice) * 100;
}

function parseOptionalNumber(
  raw: string,
  field: keyof ProductFormValues,
  errors: ProductFormErrors,
  opts: { min?: number; max?: number; tab: ProductFormTab },
): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (Number.isNaN(n)) {
    errors[field] = "Informe um número válido.";
    return undefined;
  }
  if (opts.min != null && n < opts.min) {
    errors[field] = `Valor mínimo: ${opts.min}.`;
    return undefined;
  }
  if (opts.max != null && n > opts.max) {
    errors[field] = `Valor máximo: ${opts.max}.`;
    return undefined;
  }
  return n;
}

function parseOptionalInt(
  raw: string,
  field: keyof ProductFormValues,
  errors: ProductFormErrors,
  opts: { min?: number; tab: ProductFormTab },
): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (Number.isNaN(n) || !Number.isInteger(n)) {
    errors[field] = "Informe um número inteiro válido.";
    return undefined;
  }
  if (opts.min != null && n < opts.min) {
    errors[field] = `Valor mínimo: ${opts.min}.`;
    return undefined;
  }
  return n;
}

const TAB_FIELDS: Record<ProductFormTab, (keyof ProductFormValues)[]> = {
  principal: [
    "name",
    "categoryId",
    "productLine",
    "productClassification",
    "sku",
    "barcode",
    "description",
    "imageUrl",
  ],
  precos: [
    "basePrice",
    "costPrice",
    "factoryPrice",
    "maxSalePrice",
    "minSaleUnitPrice",
    "maxSellerDiscountPercent",
    "freightAmount",
  ],
  comissoes: ["commissionPercent", "collectionCommissionPercent"],
  estoque: [
    "stockQty",
    "minStockQty",
    "maxStockQty",
    "stockAddress",
    "purchaseUnit",
    "standardPurchaseBoxQty",
    "grossWeightKg",
    "netWeightKg",
    "maxDailyQtyPerSeller",
    "maxDailyQtyPerCustomer",
  ],
  fiscal: [
    "ncm",
    "ncmException",
    "nfeOrigin",
    "fiscalClass",
    "pisCofinsClassification",
    "cstPis",
    "ipiPercent",
    "icmsCostPercent",
    "cbsIbsClassification",
  ],
  fornecedor: ["supplierId"],
  atributos: [],
};

function firstTabWithError(
  errors: ProductFormErrors,
): ProductFormTab | undefined {
  for (const [tab, fields] of Object.entries(TAB_FIELDS) as [
    ProductFormTab,
    (keyof ProductFormValues)[],
  ][]) {
    if (fields.some((f) => errors[f])) return tab;
  }
  return undefined;
}

export function validateProductForm(
  values: ProductFormValues,
): ProductFormValidation {
  const errors: ProductFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Informe o nome do produto.";
  }

  if (!values.categoryId.trim()) {
    errors.categoryId = "Selecione o grupo de produtos.";
  }

  if (!values.supplierId.trim()) {
    errors.supplierId = "Selecione o fornecedor.";
  }

  const basePriceRaw = values.basePrice.trim();
  if (basePriceRaw === "") {
    errors.basePrice = "Informe o preço de venda.";
  } else {
    const basePrice = Number(basePriceRaw);
    if (Number.isNaN(basePrice) || basePrice < 0) {
      errors.basePrice = "Preço de venda inválido (≥ 0).";
    }
  }

  const stockRaw = values.stockQty.trim();
  if (stockRaw === "") {
    errors.stockQty = "Informe o estoque atual.";
  } else {
    const stock = Number(stockRaw);
    if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      errors.stockQty = "Estoque deve ser um inteiro ≥ 0.";
    }
  }

  const minStock = parseOptionalInt(values.minStockQty, "minStockQty", errors, {
    min: 0,
    tab: "estoque",
  });
  const maxStock = parseOptionalInt(values.maxStockQty, "maxStockQty", errors, {
    min: 0,
    tab: "estoque",
  });
  if (minStock != null && maxStock != null && minStock > maxStock) {
    errors.maxStockQty = "Qtd. máxima deve ser ≥ estoque mínimo.";
  }

  parseOptionalNumber(values.costPrice, "costPrice", errors, {
    min: 0,
    tab: "precos",
  });
  parseOptionalNumber(values.factoryPrice, "factoryPrice", errors, {
    min: 0,
    tab: "precos",
  });
  parseOptionalNumber(values.maxSalePrice, "maxSalePrice", errors, {
    min: 0,
    tab: "precos",
  });
  parseOptionalNumber(values.minSaleUnitPrice, "minSaleUnitPrice", errors, {
    min: 0,
    tab: "precos",
  });
  parseOptionalNumber(
    values.maxSellerDiscountPercent,
    "maxSellerDiscountPercent",
    errors,
    { min: 0, max: 100, tab: "precos" },
  );
  parseOptionalNumber(values.freightAmount, "freightAmount", errors, {
    min: 0,
    tab: "precos",
  });
  parseOptionalNumber(values.commissionPercent, "commissionPercent", errors, {
    min: 0,
    max: 100,
    tab: "comissoes",
  });
  parseOptionalNumber(
    values.collectionCommissionPercent,
    "collectionCommissionPercent",
    errors,
    { min: 0, max: 100, tab: "comissoes" },
  );
  parseOptionalInt(
    values.standardPurchaseBoxQty,
    "standardPurchaseBoxQty",
    errors,
    { min: 1, tab: "estoque" },
  );
  parseOptionalNumber(values.grossWeightKg, "grossWeightKg", errors, {
    min: 0,
    tab: "estoque",
  });
  parseOptionalNumber(values.netWeightKg, "netWeightKg", errors, {
    min: 0,
    tab: "estoque",
  });
  parseOptionalInt(
    values.maxDailyQtyPerSeller,
    "maxDailyQtyPerSeller",
    errors,
    { min: 1, tab: "estoque" },
  );
  parseOptionalInt(
    values.maxDailyQtyPerCustomer,
    "maxDailyQtyPerCustomer",
    errors,
    { min: 1, tab: "estoque" },
  );
  parseOptionalNumber(values.ipiPercent, "ipiPercent", errors, {
    min: 0,
    max: 100,
    tab: "fiscal",
  });
  parseOptionalNumber(values.icmsCostPercent, "icmsCostPercent", errors, {
    min: 0,
    max: 100,
    tab: "fiscal",
  });

  const ncmRaw = values.ncm.trim();
  if (ncmRaw && !isNcmComplete(ncmRaw)) {
    errors.ncm = "NCM deve ter 8 dígitos.";
  }

  const nfeOriginRaw = values.nfeOrigin.trim();
  if (nfeOriginRaw) {
    const origin = Number(nfeOriginRaw);
    if (
      Number.isNaN(origin) ||
      origin < 0 ||
      origin > 8 ||
      !Number.isInteger(origin)
    ) {
      errors.nfeOrigin = "Origem NF-e deve ser um inteiro entre 0 e 8.";
    }
  }

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    firstErrorTab: ok ? undefined : firstTabWithError(errors),
  };
}

export type ProductApiPayload = {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  basePrice: number;
  categoryId: string;
  supplierId: string;
  productLine?: string | null;
  productClassification?: ProductClassification | null;
  costPrice?: number | null;
  factoryPrice?: number | null;
  maxSalePrice?: number | null;
  minSaleUnitPrice?: number | null;
  maxSellerDiscountPercent?: number | null;
  freightAmount?: number | null;
  commissionPercent?: number | null;
  collectionCommissionPercent?: number | null;
  stockQty?: number;
  minStockQty?: number;
  maxStockQty?: number | null;
  blockSaleWhenOutOfStock?: boolean;
  stockAddress?: string | null;
  purchaseUnit?: string | null;
  standardPurchaseBoxQty?: number | null;
  grossWeightKg?: number | null;
  netWeightKg?: number | null;
  maxDailyQtyPerSeller?: number | null;
  maxDailyQtyPerCustomer?: number | null;
  ncm?: string | null;
  ncmException?: string | null;
  nfeOrigin?: number | null;
  fiscalClass?: string | null;
  pisCofinsClassification?: string | null;
  cstPis?: string | null;
  ipiPercent?: number | null;
  icmsCostPercent?: number | null;
  cbsIbsClassification?: string | null;
  attributes?: Record<string, unknown>;
};

function strOrNull(raw: string): string | null {
  const t = raw.trim();
  return t.length ? t : null;
}

export function formToProductPayload(
  values: ProductFormValues,
  attributes: Record<string, unknown>,
): ProductApiPayload {
  const validation = validateProductForm(values);
  if (!validation.ok) {
    throw new Error(validation.errors._form ?? "Corrija os campos destacados.");
  }

  const ncm = normalizeNcm(values.ncm);
  const cleanedAttrs = { ...attributes };
  if (ncm) cleanedAttrs.ncm = ncm;
  else delete cleanedAttrs.ncm;

  return {
    name: values.name.trim(),
    sku: strOrNull(values.sku),
    barcode: strOrNull(values.barcode),
    description: strOrNull(values.description),
    imageUrl: strOrNull(values.imageUrl),
    basePrice: Number(values.basePrice),
    categoryId: values.categoryId.trim(),
    supplierId: values.supplierId.trim(),
    productLine: strOrNull(values.productLine),
    productClassification: values.productClassification || null,
    costPrice: values.costPrice.trim() ? Number(values.costPrice) : null,
    factoryPrice: values.factoryPrice.trim()
      ? Number(values.factoryPrice)
      : null,
    maxSalePrice: values.maxSalePrice.trim()
      ? Number(values.maxSalePrice)
      : null,
    minSaleUnitPrice: values.minSaleUnitPrice.trim()
      ? Number(values.minSaleUnitPrice)
      : null,
    maxSellerDiscountPercent: values.maxSellerDiscountPercent.trim()
      ? Number(values.maxSellerDiscountPercent)
      : null,
    freightAmount: values.freightAmount.trim()
      ? Number(values.freightAmount)
      : null,
    commissionPercent: values.commissionPercent.trim()
      ? Number(values.commissionPercent)
      : null,
    collectionCommissionPercent: values.collectionCommissionPercent.trim()
      ? Number(values.collectionCommissionPercent)
      : null,
    stockQty: Number(values.stockQty),
    minStockQty: Number(values.minStockQty || "0"),
    maxStockQty: values.maxStockQty.trim() ? Number(values.maxStockQty) : null,
    blockSaleWhenOutOfStock: values.blockSaleWhenOutOfStock,
    stockAddress: strOrNull(values.stockAddress),
    purchaseUnit: strOrNull(values.purchaseUnit),
    standardPurchaseBoxQty: values.standardPurchaseBoxQty.trim()
      ? Number(values.standardPurchaseBoxQty)
      : null,
    grossWeightKg: values.grossWeightKg.trim()
      ? Number(values.grossWeightKg)
      : null,
    netWeightKg: values.netWeightKg.trim() ? Number(values.netWeightKg) : null,
    maxDailyQtyPerSeller: values.maxDailyQtyPerSeller.trim()
      ? Number(values.maxDailyQtyPerSeller)
      : null,
    maxDailyQtyPerCustomer: values.maxDailyQtyPerCustomer.trim()
      ? Number(values.maxDailyQtyPerCustomer)
      : null,
    ncm: ncm || null,
    ncmException: strOrNull(values.ncmException),
    nfeOrigin: values.nfeOrigin.trim() ? Number(values.nfeOrigin) : null,
    fiscalClass: strOrNull(values.fiscalClass),
    pisCofinsClassification: strOrNull(values.pisCofinsClassification),
    cstPis: strOrNull(values.cstPis),
    ipiPercent: values.ipiPercent.trim() ? Number(values.ipiPercent) : null,
    icmsCostPercent: values.icmsCostPercent.trim()
      ? Number(values.icmsCostPercent)
      : null,
    cbsIbsClassification: strOrNull(values.cbsIbsClassification),
    attributes: cleanedAttrs,
  };
}
