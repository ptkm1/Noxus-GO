import { Prisma } from "@prisma/client";
import type { CsvColumnMap } from "@pedidos/shared";
import { prisma } from "../../db.js";
import { deriveBasePriceFromTablePrices } from "../product-cadastro-schema.js";
import {
    AUDIT_ACTION,
    AUDIT_ENTITY,
    writeAuditLog,
} from "../audit-log.js";
import {
    cell,
    parseBrNumber,
    parseCsvText,
    parseYesNo,
    remapCsvCells,
} from "./csv-parse.js";
import {
    summarizeImportRows,
    type ImportFieldError,
    type ImportPreviewResult,
    type ImportRowResult,
} from "./import-types.js";

type OrgLookups = {
  categories: Array<{ id: string; code: string; name: string }>;
  suppliers: Array<{
    id: string;
    code: string;
    tradeName: string;
    legalName: string;
  }>;
  priceTables: Array<{ id: string; name: string }>;
  existingBarcodes: Set<string>;
};

type PreparedProduct = {
  name: string;
  categoryId: string;
  supplierId: string;
  priceTableId: string;
  price: number;
  sku: string | null;
  barcode: string | null;
  stockQty: number;
  description: string | null;
  ncm: string | null;
  purchaseUnit: string | null;
  costPrice: number | null;
  blockSaleWhenOutOfStock: boolean;
};

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

async function loadOrgLookups(organizationId: string): Promise<OrgLookups> {
  const [categories, suppliers, priceTables, barcodeRows] = await Promise.all([
    prisma.productCategory.findMany({
      where: { organizationId },
      select: { id: true, code: true, name: true },
    }),
    prisma.supplier.findMany({
      where: { organizationId },
      select: { id: true, code: true, tradeName: true, legalName: true },
    }),
    prisma.priceTable.findMany({
      where: { organizationId },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { organizationId, barcode: { not: null } },
      select: { barcode: true },
    }),
  ]);
  return {
    categories,
    suppliers,
    priceTables,
    existingBarcodes: new Set(
      barcodeRows.map((b) => b.barcode!).filter(Boolean),
    ),
  };
}

function resolveCategory(
  raw: string,
  cats: OrgLookups["categories"],
): string | null {
  const k = normKey(raw);
  if (!k) return null;
  const byCode = cats.find((c) => normKey(c.code) === k);
  if (byCode) return byCode.id;
  const byName = cats.find((c) => normKey(c.name) === k);
  return byName?.id ?? null;
}

function resolveSupplier(
  raw: string,
  suppliers: OrgLookups["suppliers"],
): string | null {
  const k = normKey(raw);
  if (!k) return null;
  const byCode = suppliers.find((s) => normKey(s.code) === k);
  if (byCode) return byCode.id;
  const byTrade = suppliers.find((s) => normKey(s.tradeName) === k);
  if (byTrade) return byTrade.id;
  const byLegal = suppliers.find((s) => normKey(s.legalName) === k);
  return byLegal?.id ?? null;
}

function resolvePriceTable(
  raw: string,
  tables: OrgLookups["priceTables"],
): string | null {
  if (tables.length === 0) return null;
  const t = raw.trim();
  if (!t) return tables[0]!.id;
  const k = normKey(t);
  const byName = tables.find((x) => normKey(x.name) === k);
  return byName?.id ?? null;
}

function validateProductRow(
  cells: Record<string, string>,
  lookups: OrgLookups,
  barcodesInFile: Map<string, number>,
  line: number,
): { errors: ImportFieldError[]; prepared: PreparedProduct | null } {
  const errors: ImportFieldError[] = [];
  const nome = cell(cells, "nome");
  const grupo = cell(cells, "grupo");
  const fornecedor = cell(cells, "fornecedor");
  const precoRaw = cell(cells, "preco");
  const sku = cell(cells, "sku") || null;
  const barcodeRaw = cell(cells, "codigo_barras", "barcode");
  const estoqueRaw = cell(cells, "estoque");
  const descricao = cell(cells, "descricao") || null;
  const tabela = cell(cells, "tabela_preco");
  const ncm = cell(cells, "ncm") || null;
  const unidade = cell(cells, "unidade_compra") || null;
  const custoRaw = cell(cells, "preco_custo");
  const bloqueiaRaw = cell(cells, "bloqueia_sem_estoque");

  if (!nome) errors.push({ field: "nome", message: "Nome é obrigatório." });
  if (!grupo) errors.push({ field: "grupo", message: "Grupo é obrigatório." });
  if (!fornecedor)
    errors.push({ field: "fornecedor", message: "Fornecedor é obrigatório." });

  const price = parseBrNumber(precoRaw);
  if (precoRaw === "") {
    errors.push({ field: "preco", message: "Preço é obrigatório." });
  } else if (price == null || price < 0) {
    errors.push({ field: "preco", message: "Preço inválido." });
  }

  const categoryId = grupo ? resolveCategory(grupo, lookups.categories) : null;
  if (grupo && !categoryId) {
    errors.push({
      field: "grupo",
      message: "Grupo não encontrado (use código ou nome).",
    });
  }

  const supplierId = fornecedor
    ? resolveSupplier(fornecedor, lookups.suppliers)
    : null;
  if (fornecedor && !supplierId) {
    errors.push({
      field: "fornecedor",
      message: "Fornecedor não encontrado (use código ou nome).",
    });
  }

  if (lookups.priceTables.length === 0) {
    errors.push({
      field: "tabela_preco",
      message: "Organização sem tabela de preço cadastrada.",
    });
  }
  const priceTableId = resolvePriceTable(tabela, lookups.priceTables);
  if (tabela && !priceTableId) {
    errors.push({
      field: "tabela_preco",
      message: "Tabela de preço não encontrada.",
    });
  }

  let stockQty = 0;
  if (estoqueRaw) {
    const n = parseBrNumber(estoqueRaw);
    if (n == null || !Number.isInteger(n) || n < 0) {
      errors.push({ field: "estoque", message: "Estoque deve ser inteiro ≥ 0." });
    } else {
      stockQty = n;
    }
  }

  let costPrice: number | null = null;
  if (custoRaw) {
    const n = parseBrNumber(custoRaw);
    if (n == null || n < 0) {
      errors.push({ field: "preco_custo", message: "Preço de custo inválido." });
    } else {
      costPrice = n;
    }
  }

  let blockSaleWhenOutOfStock = false;
  if (bloqueiaRaw) {
    const b = parseYesNo(bloqueiaRaw);
    if (b == null) {
      errors.push({
        field: "bloqueia_sem_estoque",
        message: "Use sim ou nao.",
      });
    } else {
      blockSaleWhenOutOfStock = b;
    }
  }

  if (ncm && !/^\d{8}$/.test(ncm.replace(/\D/g, ""))) {
    errors.push({ field: "ncm", message: "NCM deve ter 8 dígitos." });
  }

  const barcode = barcodeRaw.trim() || null;
  if (barcode) {
    if (barcode.length > 80) {
      errors.push({
        field: "codigo_barras",
        message: "Código de barras muito longo.",
      });
    }
    if (lookups.existingBarcodes.has(barcode)) {
      errors.push({
        field: "codigo_barras",
        message: "Código de barras já cadastrado nesta empresa.",
      });
    }
    const prevLine = barcodesInFile.get(barcode);
    if (prevLine != null && prevLine !== line) {
      errors.push({
        field: "codigo_barras",
        message: `Duplicado no arquivo (linha ${prevLine}).`,
      });
    } else {
      barcodesInFile.set(barcode, line);
    }
  }

  if (errors.length || !categoryId || !supplierId || !priceTableId || price == null) {
    return { errors, prepared: null };
  }

  return {
    errors: [],
    prepared: {
      name: nome,
      categoryId,
      supplierId,
      priceTableId,
      price,
      sku,
      barcode,
      stockQty,
      description: descricao,
      ncm: ncm ? ncm.replace(/\D/g, "") : null,
      purchaseUnit: unidade,
      costPrice,
      blockSaleWhenOutOfStock,
    },
  };
}

export async function previewProductImport(
  organizationId: string,
  csvText: string,
  columnMap?: CsvColumnMap,
): Promise<ImportPreviewResult> {
  const parsed = parseCsvText(csvText);
  const lookups = await loadOrgLookups(organizationId);
  const barcodesInFile = new Map<string, number>();
  const rows: ImportRowResult[] = [];

  for (const row of parsed.rows) {
    const cells = remapCsvCells(row.cells, columnMap);
    const { errors, prepared } = validateProductRow(
      cells,
      lookups,
      barcodesInFile,
      row.line,
    );
    rows.push({
      line: row.line,
      status: errors.length ? "error" : "ok",
      errors,
      preview: prepared
        ? {
            nome: prepared.name,
            preco: String(prepared.price),
            estoque: String(prepared.stockQty),
            sku: prepared.sku ?? "",
            codigo_barras: prepared.barcode ?? "",
          }
        : {
            nome: cell(cells, "nome"),
            preco: cell(cells, "preco"),
          },
    });
  }

  return summarizeImportRows(rows);
}

export async function commitProductImport(params: {
  organizationId: string;
  actorUserId: string;
  actorMatricula: string | null;
  csvText: string;
  columnMap?: CsvColumnMap;
}): Promise<ImportPreviewResult> {
  const parsed = parseCsvText(params.csvText);
  const lookups = await loadOrgLookups(params.organizationId);
  const barcodesInFile = new Map<string, number>();
  const rows: ImportRowResult[] = [];
  const preparedList: Array<{ line: number; data: PreparedProduct }> = [];

  for (const row of parsed.rows) {
    const cells = remapCsvCells(row.cells, params.columnMap);
    const { errors, prepared } = validateProductRow(
      cells,
      lookups,
      barcodesInFile,
      row.line,
    );
    if (errors.length || !prepared) {
      rows.push({
        line: row.line,
        status: "error",
        errors,
        preview: { nome: cell(cells, "nome") },
      });
      continue;
    }
    rows.push({
      line: row.line,
      status: "ok",
      errors: [],
      preview: { nome: prepared.name, preco: String(prepared.price) },
    });
    preparedList.push({ line: row.line, data: prepared });
  }

  let createdCount = 0;
  for (const item of preparedList) {
    const d = item.data;
    const basePrice = deriveBasePriceFromTablePrices([d.price]);
    try {
      const created = await prisma.product.create({
        data: {
          name: d.name,
          sku: d.sku ?? undefined,
          barcode: d.barcode ?? undefined,
          description: d.description ?? undefined,
          basePrice,
          organizationId: params.organizationId,
          categoryId: d.categoryId,
          supplierId: d.supplierId,
          stockQty: d.stockQty,
          blockSaleWhenOutOfStock: d.blockSaleWhenOutOfStock,
          ...(d.ncm ? { ncm: d.ncm } : {}),
          ...(d.purchaseUnit ? { purchaseUnit: d.purchaseUnit } : {}),
          ...(d.costPrice != null ? { costPrice: d.costPrice } : {}),
        },
      });
      await prisma.priceTableItem.create({
        data: {
          priceTableId: d.priceTableId,
          productId: created.id,
          price: d.price,
        },
      });
      if (d.stockQty > 0) {
        await prisma.stockMovement.create({
          data: {
            organizationId: params.organizationId,
            productId: created.id,
            type: "ADJUST",
            qtyDelta: d.stockQty,
            balanceAfter: d.stockQty,
            userId: params.actorUserId,
            reason: "Estoque inicial (importação CSV)",
          },
        });
      }
      await writeAuditLog({
        organizationId: params.organizationId,
        userId: params.actorUserId,
        userMatricula: params.actorMatricula,
        action: AUDIT_ACTION.CREATE,
        entityType: AUDIT_ENTITY.Product,
        entityId: created.id,
        metadata: { name: created.name, source: "csv_import" },
      });
      if (d.barcode) lookups.existingBarcodes.add(d.barcode);
      createdCount += 1;
    } catch (e) {
      const msg =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
          ? "Conflito de unicidade (código de barras)."
          : e instanceof Error
            ? e.message
            : "Falha ao criar produto.";
      const row = rows.find((r) => r.line === item.line);
      if (row) {
        row.status = "error";
        row.errors = [{ field: "_", message: msg }];
      }
    }
  }

  return summarizeImportRows(rows, createdCount);
}
