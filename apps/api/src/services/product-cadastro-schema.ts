import { z } from "zod";

const optionalPercentSchema = z.number().min(0).max(100).nullable().optional();

const optionalMoneySchema = z.number().nonnegative().nullable().optional();

const optionalWeightSchema = z.number().nonnegative().nullable().optional();

export const productClassificationSchema = z.enum([
  "RESALE",
  "RAW_MATERIAL",
  "INTERNAL_USE",
  "SERVICE",
  "OTHER",
]);

const ncmSchema = z.preprocess(
  (val) => {
    if (val === undefined) return undefined;
    if (val === null || val === "") return null;
    if (typeof val === "string") {
      const digits = val.replace(/\D/g, "");
      return digits.length > 0 ? digits : null;
    }
    return val;
  },
  z
    .union([z.string().regex(/^\d{8}$/, "NCM deve ter 8 dígitos"), z.null()])
    .optional(),
);

const nfeOriginSchema = z.number().int().min(0).max(8).nullable().optional();

/** Campos compartilhados de cadastro de produto (POST/PATCH admin). */
export const productCadastroFieldsSchema = {
  productLine: z.string().max(120).nullable().optional(),
  productClassification: productClassificationSchema.nullable().optional(),
  purchaseUnit: z.string().max(20).nullable().optional(),
  standardPurchaseBoxQty: z.number().int().min(1).nullable().optional(),
  grossWeightKg: optionalWeightSchema,
  netWeightKg: optionalWeightSchema,
  stockAddress: z.string().max(200).nullable().optional(),
  minStockQty: z.number().int().min(0).optional(),
  maxStockQty: z.number().int().min(0).nullable().optional(),
  costPrice: optionalMoneySchema,
  factoryPrice: optionalMoneySchema,
  maxSalePrice: optionalMoneySchema,
  freightAmount: optionalMoneySchema,
  collectionCommissionPercent: optionalPercentSchema,
  maxDailyQtyPerSeller: z.number().int().min(1).nullable().optional(),
  maxDailyQtyPerCustomer: z.number().int().min(1).nullable().optional(),
  ncm: ncmSchema,
  ncmException: z.string().max(40).nullable().optional(),
  nfeOrigin: nfeOriginSchema,
  fiscalClass: z.string().max(120).nullable().optional(),
  pisCofinsClassification: z.string().max(120).nullable().optional(),
  // Formulário aceita rótulo completo (ex.: "01 - Operação Tributável…"); NFe usa só os dígitos depois.
  cstPis: z.string().max(120).nullable().optional(),
  ipiPercent: optionalPercentSchema,
  icmsCostPercent: optionalPercentSchema,
  cbsIbsClassification: z.string().max(200).nullable().optional(),
};

export function normalizeProductNcm(
  raw: string | undefined | null,
): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return digits.length > 0 ? digits : null;
}

/** Remove `ncm` duplicado em attributes quando a coluna canônica é usada. */
export function syncProductAttributesNcm(
  attributes: Record<string, unknown>,
  ncm: string | null | undefined,
): Record<string, unknown> {
  const next = { ...attributes };
  if (ncm) next.ncm = ncm;
  else delete next.ncm;
  return next;
}

export function pickProductCadastroData<T extends Record<string, unknown>>(
  body: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(productCadastroFieldsSchema)) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

type CadastroInput = {
  productLine?: string | null;
  productClassification?: z.infer<typeof productClassificationSchema> | null;
  purchaseUnit?: string | null;
  standardPurchaseBoxQty?: number | null;
  grossWeightKg?: number | null;
  netWeightKg?: number | null;
  stockAddress?: string | null;
  minStockQty?: number;
  maxStockQty?: number | null;
  costPrice?: number | null;
  factoryPrice?: number | null;
  maxSalePrice?: number | null;
  freightAmount?: number | null;
  collectionCommissionPercent?: number | null;
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
};

/** Mapeia campos de cadastro para create/update Prisma (undefined = não alterar). */
export function mapProductCadastroPrisma(
  body: Partial<CadastroInput>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.productLine !== undefined) data.productLine = body.productLine;
  if (body.productClassification !== undefined) {
    data.productClassification = body.productClassification;
  }
  if (body.purchaseUnit !== undefined) data.purchaseUnit = body.purchaseUnit;
  if (body.standardPurchaseBoxQty !== undefined) {
    data.standardPurchaseBoxQty = body.standardPurchaseBoxQty;
  }
  if (body.grossWeightKg !== undefined) data.grossWeightKg = body.grossWeightKg;
  if (body.netWeightKg !== undefined) data.netWeightKg = body.netWeightKg;
  if (body.stockAddress !== undefined) data.stockAddress = body.stockAddress;
  if (body.minStockQty !== undefined) data.minStockQty = body.minStockQty;
  if (body.maxStockQty !== undefined) data.maxStockQty = body.maxStockQty;
  if (body.costPrice !== undefined) data.costPrice = body.costPrice;
  if (body.factoryPrice !== undefined) data.factoryPrice = body.factoryPrice;
  if (body.maxSalePrice !== undefined) data.maxSalePrice = body.maxSalePrice;
  if (body.freightAmount !== undefined) data.freightAmount = body.freightAmount;
  if (body.collectionCommissionPercent !== undefined) {
    data.collectionCommissionPercent = body.collectionCommissionPercent;
  }
  if (body.maxDailyQtyPerSeller !== undefined) {
    data.maxDailyQtyPerSeller = body.maxDailyQtyPerSeller;
  }
  if (body.maxDailyQtyPerCustomer !== undefined) {
    data.maxDailyQtyPerCustomer = body.maxDailyQtyPerCustomer;
  }
  if (body.ncm !== undefined) {
    data.ncm =
      body.ncm === null ? null : (normalizeProductNcm(body.ncm) ?? null);
  }
  if (body.ncmException !== undefined) data.ncmException = body.ncmException;
  if (body.nfeOrigin !== undefined) data.nfeOrigin = body.nfeOrigin;
  if (body.fiscalClass !== undefined) data.fiscalClass = body.fiscalClass;
  if (body.pisCofinsClassification !== undefined) {
    data.pisCofinsClassification = body.pisCofinsClassification;
  }
  if (body.cstPis !== undefined) data.cstPis = body.cstPis;
  if (body.ipiPercent !== undefined) data.ipiPercent = body.ipiPercent;
  if (body.icmsCostPercent !== undefined) {
    data.icmsCostPercent = body.icmsCostPercent;
  }
  if (body.cbsIbsClassification !== undefined) {
    data.cbsIbsClassification = body.cbsIbsClassification;
  }
  return data;
}
