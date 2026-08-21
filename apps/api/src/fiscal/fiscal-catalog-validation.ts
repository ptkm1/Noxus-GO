import {
  normalizeCestCode,
  normalizeCfopCode,
  normalizeNcmCode,
  type FiscalTaxRegime,
} from "@pedidos/shared";
import type { Product } from "@prisma/client";
import {
  countFiscalCatalogByType,
  resolveFiscalCatalogCode,
} from "../services/fiscal/fiscal-catalog.js";
import type { FiscalReadinessIssue } from "./validation.js";

export type ProductFiscalValidationInput = Pick<
  Product,
  | "name"
  | "ncm"
  | "ncmId"
  | "fiscalOrigin"
  | "nfeOrigin"
  | "fiscalUnit"
  | "purchaseUnit"
  | "fiscalCest"
  | "cstPis"
  | "fiscalCstIcms"
  | "fiscalCsosn"
  | "cbsIbsClassification"
  | "ibsClassification"
> & {
  outboundOperation?: { cfop: string; direction: string; active: boolean } | null;
};

/**
 * Validação preventiva antes de enviar à SEFAZ.
 * Verifica preenchimento, formato e existência no catálogo (quando houver dados).
 */
export async function validateProductFiscalAgainstCatalog(
  product: ProductFiscalValidationInput,
  opts: { regime: FiscalTaxRegime; operationKind?: "OUTBOUND" | "INBOUND" },
): Promise<FiscalReadinessIssue[]> {
  const issues: FiscalReadinessIssue[] = [];
  const label = product.name;

  const ncmRaw = product.ncm?.replace(/\D/g, "") ?? "";
  const hasNcmLink = Boolean(product.ncmId);
  if (!hasNcmLink && ncmRaw.length !== 8) {
    issues.push({
      code: "NCM_MISSING",
      message: `Produto "${label}": informe um NCM válido (8 dígitos).`,
    });
  } else if (ncmRaw.length === 8) {
    const catalogCount = await countFiscalCatalogByType("NCM");
    if (catalogCount > 0) {
      const found = await resolveFiscalCatalogCode({
        type: "NCM",
        code: ncmRaw,
        includeInactive: true,
      });
      if (!found) {
        issues.push({
          code: "NCM_UNKNOWN",
          message: `Produto "${label}": NCM ${ncmRaw} não existe na tabela fiscal do sistema.`,
        });
      } else if (found.outdated) {
        issues.push({
          code: "NCM_INACTIVE",
          message: `Produto "${label}": NCM ${ncmRaw} está inativo ou fora de vigência.`,
        });
      }
    }
  }

  const origin = product.fiscalOrigin ?? product.nfeOrigin;
  if (origin == null) {
    issues.push({
      code: "ORIGIN_MISSING",
      message: `Produto "${label}": informe a origem da mercadoria (0–8).`,
    });
  } else {
    const found = await resolveFiscalCatalogCode({
      type: "ORIGEM",
      code: String(origin),
    });
    if (!found) {
      issues.push({
        code: "ORIGIN_INVALID",
        message: `Produto "${label}": origem ${origin} não é válida.`,
      });
    }
  }

  if (!product.fiscalUnit?.trim() && !product.purchaseUnit?.trim()) {
    issues.push({
      code: "UNIT_MISSING",
      message: `Produto "${label}": informe a unidade fiscal.`,
    });
  }

  if (product.fiscalCest?.trim()) {
    const cest = normalizeCestCode(product.fiscalCest);
    if (cest.length !== 7) {
      issues.push({
        code: "CEST_FORMAT",
        message: `Produto "${label}": CEST deve ter 7 dígitos.`,
      });
    } else {
      const catalogCount = await countFiscalCatalogByType("CEST");
      if (catalogCount > 0) {
        const found = await resolveFiscalCatalogCode({
          type: "CEST",
          code: cest,
          includeInactive: true,
        });
        if (!found) {
          issues.push({
            code: "CEST_UNKNOWN",
            message: `Produto "${label}": CEST ${cest} não existe na tabela fiscal do sistema.`,
          });
        } else if (found.outdated) {
          issues.push({
            code: "CEST_INACTIVE",
            message: `Produto "${label}": CEST ${cest} está inativo ou fora de vigência.`,
          });
        }
      }
    }
  }

  const cfop = product.outboundOperation?.cfop;
  if (cfop) {
    const normalized = normalizeCfopCode(cfop);
    const catalogCount = await countFiscalCatalogByType("CFOP");
    if (catalogCount > 0) {
      const found = await resolveFiscalCatalogCode({
        type: "CFOP",
        code: normalized,
        includeInactive: true,
      });
      if (!found) {
        issues.push({
          code: "CFOP_UNKNOWN",
          message: `Produto "${label}": CFOP ${normalized} não é válido na tabela do sistema.`,
        });
      } else if (found.outdated) {
        issues.push({
          code: "CFOP_INACTIVE",
          message: `Produto "${label}": CFOP ${normalized} está inativo ou fora de vigência.`,
        });
      } else if (opts.operationKind === "OUTBOUND") {
        const first = normalized[0];
        if (first !== "5" && first !== "6" && first !== "7") {
          issues.push({
            code: "CFOP_CONTEXT",
            message: `CFOP informado não é válido para esta operação de saída (produto "${label}").`,
          });
        }
      }
    }
    if (product.outboundOperation && !product.outboundOperation.active) {
      issues.push({
        code: "CFOP_OP_INACTIVE",
        message: `Produto "${label}": a operação fiscal (CFOP) vinculada está inativa.`,
      });
    }
  }

  const regime = opts.regime;
  if (regime === "SIMPLES_NACIONAL") {
    if (product.fiscalCstIcms?.trim() && !product.fiscalCsosn?.trim()) {
      issues.push({
        code: "REGIME_CST",
        message: `Produto "${label}": no Simples Nacional use CSOSN (não CST ICMS).`,
      });
    }
    if (product.fiscalCsosn?.trim()) {
      const found = await resolveFiscalCatalogCode({
        type: "CSOSN",
        code: product.fiscalCsosn.trim(),
      });
      if (!found) {
        issues.push({
          code: "CSOSN_UNKNOWN",
          message: `Produto "${label}": CSOSN ${product.fiscalCsosn} inválido.`,
        });
      }
    }
  } else {
    if (product.fiscalCsosn?.trim() && !product.fiscalCstIcms?.trim()) {
      issues.push({
        code: "REGIME_CSOSN",
        message: `Produto "${label}": fora do Simples Nacional use CST ICMS (não CSOSN).`,
      });
    }
    if (product.fiscalCstIcms?.trim()) {
      const found = await resolveFiscalCatalogCode({
        type: "CST_ICMS",
        code: product.fiscalCstIcms.trim(),
      });
      if (!found) {
        issues.push({
          code: "CST_UNKNOWN",
          message: `Produto "${label}": CST ICMS ${product.fiscalCstIcms} inválido.`,
        });
      }
    }
  }

  if (product.cstPis?.trim()) {
    const catalogCount = await countFiscalCatalogByType("CST_PIS");
    if (catalogCount > 0) {
      const found = await resolveFiscalCatalogCode({
        type: "CST_PIS",
        code: product.cstPis.trim(),
      });
      if (!found) {
        issues.push({
          code: "CST_PIS_UNKNOWN",
          message: `Produto "${label}": CST PIS ${product.cstPis} inválido.`,
        });
      }
    }
  }

  for (const [field, type, value] of [
    ["CBS", "CBS", product.cbsIbsClassification],
    ["IBS", "IBS", product.ibsClassification],
  ] as const) {
    const code = value?.trim();
    if (!code) continue;
    const catalogCount = await countFiscalCatalogByType(type);
    if (catalogCount === 0) continue;
    const found = await resolveFiscalCatalogCode({ type, code });
    if (!found) {
      issues.push({
        code: `${field}_UNKNOWN`,
        message: `Produto "${label}": código ${field} ${code} não encontrado na tabela oficial carregada.`,
      });
    }
  }

  return issues;
}

/** Wrapper síncrono legado + checagens básicas de formato (sem DB). */
export function validateProductFiscalBasic(
  product: ProductFiscalValidationInput,
): FiscalReadinessIssue[] {
  const missing: string[] = [];
  const hasNcm =
    Boolean(product.ncmId) ||
    Boolean(product.ncm && normalizeNcmCode(product.ncm).length === 8);
  if (!hasNcm) missing.push("NCM");
  if (product.fiscalOrigin == null && product.nfeOrigin == null) {
    missing.push("origem");
  }
  if (!product.fiscalUnit?.trim() && !product.purchaseUnit?.trim()) {
    missing.push("unidade fiscal");
  }
  if (!missing.length) return [];
  return [
    {
      code: "PRODUCT_FISCAL",
      message: `Produto "${product.name}" incompleto: falta ${missing.join(", ")}`,
    },
  ];
}
