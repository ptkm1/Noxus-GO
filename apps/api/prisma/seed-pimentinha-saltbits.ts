import { prisma } from "../src/db.js";

const BARCODE = "7897750310021";
const SKU = "001";
/** Convênio ICMS 92/2015 — segmento 17 (alimentos), bolachas/biscoitos (NCM 1905.31.00). */
const CEST_BISCOITOS = "1700500";
const NCM = "19053100";

export async function upsertPimentinhaSaltbits(organizationId?: string) {
  const org =
    organizationId != null
      ? await prisma.organization.findUniqueOrThrow({
          where: { id: organizationId },
        })
      : await prisma.organization.findFirstOrThrow({
          where: { id: "seed-org" },
        });

  const supplier = await prisma.supplier.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: "BISC-CROC" },
    },
    create: {
      organizationId: org.id,
      code: "BISC-CROC",
      legalName: "Indústria e Comércio de Biscoitos Crocante",
      cnpj: "49932607000107",
      tradeName: "BISCOITOS CROCANTE",
    },
    update: { tradeName: "BISCOITOS CROCANTE" },
  });

  const category = await prisma.productCategory.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: "SNACK" },
    },
    create: {
      organizationId: org.id,
      code: "SNACK",
      name: "Snack / Salgadinhos",
    },
    update: {},
  });

  const fiscalNcm = await prisma.fiscalNcm.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: NCM },
    },
    create: {
      organizationId: org.id,
      code: NCM,
      description: "Bolachas e biscoitos, adicionados de edulcorante",
      cest: CEST_BISCOITOS,
      defaultCsosn: "102",
      icmsRate: 0,
    },
    update: {
      description: "Bolachas e biscoitos, adicionados de edulcorante",
      cest: CEST_BISCOITOS,
    },
  });

  const operation = await prisma.fiscalOperation.upsert({
    where: {
      organizationId_direction_cfop: {
        organizationId: org.id,
        direction: "OUTBOUND",
        cfop: "5102",
      },
    },
    create: {
      organizationId: org.id,
      direction: "OUTBOUND",
      cfop: "5102",
      description: "Venda de mercadoria",
      nature: "Venda",
      defaultCsosn: "102",
      movesStock: true,
    },
    update: {},
  });

  const data = {
    name: "PIMENTINHA SALTBITS FD COM 20 UNI",
    sku: SKU,
    barcode: BARCODE,
    description: "PIMENTINHA SALTBITS FD COM 20 UNI",
    basePrice: 56,
    costPrice: 31,
    factoryPrice: null as number | null,
    maxSalePrice: null as number | null,
    freightAmount: 0,
    commissionPercent: 8,
    collectionCommissionPercent: 8,
    maxSellerDiscountPercent: 0,
    stockQty: 48,
    minStockQty: 0,
    maxStockQty: null as number | null,
    productLine: "Linha 1",
    productClassification: "RESALE" as const,
    purchaseUnit: "UN",
    fiscalUnit: "FD",
    fiscalGtin: BARCODE,
    fiscalCest: CEST_BISCOITOS,
    fiscalDescription: "PIMENTINHA SALTBITS FD COM 20 UNI",
    standardPurchaseBoxQty: 1,
    grossWeightKg: null as number | null,
    netWeightKg: null as number | null,
    stockAddress: null as string | null,
    maxDailyQtyPerSeller: null as number | null,
    maxDailyQtyPerCustomer: null as number | null,
    ncm: NCM,
    ncmId: fiscalNcm.id,
    ncmException: null as string | null,
    nfeOrigin: 0,
    fiscalOrigin: 0,
    outboundOperationId: operation.id,
    fiscalClass: "PRODUTOS PARA REVEND",
    pisCofinsClassification: "Neutro",
    cstPis: "01",
    ipiPercent: 0,
    icmsCostPercent: 0,
    cbsIbsClassification:
      "000001-Situações tributadas integralmente pelo IBS e CBS.",
    categoryId: category.id,
    supplierId: supplier.id,
    attributes: {
      sale_unit: "FD",
      net_content: "20 un",
      brand: "Saltbits",
      gtin: BARCODE,
      product_type: "PIMENTINHA",
      origin_country: "BR",
    },
  };

  const existing = await prisma.product.findFirst({
    where: { organizationId: org.id, barcode: BARCODE },
  });

  const product = existing
    ? await prisma.product.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.product.create({
        data: { ...data, organizationId: org.id },
      });

  const seller = await prisma.seller.findFirst({
    where: { organizationId: org.id },
    orderBy: { createdAt: "asc" },
  });
  if (seller) {
    await prisma.sellerProduct.createMany({
      data: [{ sellerId: seller.id, productId: product.id }],
      skipDuplicates: true,
    });
  }

  console.log("Produto Pimentinha Saltbits:");
  console.log(`  org:      ${org.name} (${org.id})`);
  console.log(`  id:       ${product.id}`);
  console.log(`  sku:      ${SKU}`);
  console.log(`  barcode:  ${BARCODE}`);
  console.log(`  ncm/cest: ${NCM} / ${CEST_BISCOITOS}`);
  console.log(`  preço:    ${data.basePrice}`);
  console.log(`  estoque:  ${data.stockQty}`);
  return product;
}

async function resolveStandaloneOrgIds(): Promise<string[]> {
  const argId = process.argv.slice(2).find((a) => !a.startsWith("-"));
  if (argId) return [argId];

  const orgs = await prisma.organization.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const real = orgs.filter((o) => o.id !== "seed-org").map((o) => o.id);
  if (real.length > 0) return real;
  return orgs.map((o) => o.id);
}

async function main() {
  const ids = await resolveStandaloneOrgIds();
  if (!ids.length) {
    throw new Error("Nenhuma organização encontrada no banco.");
  }
  for (const id of ids) {
    await upsertPimentinhaSaltbits(id);
  }
}

const isDirectRun = process.argv[1]?.includes("seed-pimentinha-saltbits");
if (isDirectRun) {
  main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      void prisma.$disconnect();
      process.exit(1);
    });
}
