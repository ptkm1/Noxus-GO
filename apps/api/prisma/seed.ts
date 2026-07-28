import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";
import { ensureOrgRolePermissions } from "../src/services/role-permissions.js";
import { CATEGORY_SCHEMA_BY_CODE } from "./category-schemas.js";
import { upsertFiscalDemoData } from "./seed-fiscal-demo.js";
import { upsertRouteDemoCustomer } from "./seed-route-customer.js";

/** Senhas conhecidas — sempre re-hasheadas para recuperar login após DB “estranho”. */
const DEMO_ADMIN_EMAIL = "admin@demo.com";
const DEMO_ADMIN_PASSWORD = "admin123";
const DEMO_SELLER_EMAIL = "vendedor@demo.com";
const DEMO_SELLER_PASSWORD = "vendedor123";
const DEMO_MANAGER_EMAIL = "manager@demo.com";
const DEMO_MANAGER_PASSWORD = "manager123";

async function upsertDemoCategories(organizationId: string) {
  const entries = [
    { code: "GENERAL", name: "Geral", schema: CATEGORY_SCHEMA_BY_CODE.GENERAL },
    {
      code: "CONSUMABLE",
      name: "Consumíveis",
      schema: CATEGORY_SCHEMA_BY_CODE.CONSUMABLE,
    },
    { code: "FOOD", name: "Alimentos", schema: CATEGORY_SCHEMA_BY_CODE.FOOD },
    {
      code: "ALIMENTICIOS",
      name: "Produtos alimentícios",
      schema: CATEGORY_SCHEMA_BY_CODE.ALIMENTICIOS,
    },
    {
      code: "SNACK",
      name: "Snack / Salgadinhos",
      schema: CATEGORY_SCHEMA_BY_CODE.FOOD,
    },
    {
      code: "HYGIENE",
      name: "Produtos de higiene",
      schema: CATEGORY_SCHEMA_BY_CODE.HYGIENE,
    },
    {
      code: "AUTOMOTIVE",
      name: "Automotivo",
      schema: CATEGORY_SCHEMA_BY_CODE.AUTOMOTIVE,
    },
  ] as const;

  for (const e of entries) {
    await prisma.productCategory.upsert({
      where: {
        organizationId_code: { organizationId, code: e.code },
      },
      update: {
        name: e.name,
        attributeSchema: [...e.schema],
      },
      create: {
        organizationId,
        code: e.code,
        name: e.name,
        attributeSchema: [...e.schema],
      },
    });
  }
}

async function upsertDemoSupplier(organizationId: string) {
  return prisma.supplier.upsert({
    where: {
      organizationId_code: { organizationId, code: "BISC-CROC" },
    },
    create: {
      organizationId,
      code: "BISC-CROC",
      legalName: "Indústria e Comércio de Biscoitos Crocante",
      cnpj: "49932607000107",
      tradeName: "BISCOITOS CROCANTE",
    },
    update: {
      legalName: "Indústria e Comércio de Biscoitos Crocante",
      cnpj: "49932607000107",
      tradeName: "BISCOITOS CROCANTE",
    },
  });
}

async function upsertDemoFiscalLookups(organizationId: string) {
  await prisma.costCenter.upsert({
    where: {
      organizationId_code: { organizationId, code: "ADM" },
    },
    create: {
      organizationId,
      code: "ADM",
      name: "Administrativo",
    },
    update: { name: "Administrativo", active: true },
  });
  await prisma.expenseHistory.upsert({
    where: {
      organizationId_code: { organizationId, code: "IMPOSTO" },
    },
    create: {
      organizationId,
      code: "IMPOSTO",
      description: "Impostos e taxas",
    },
    update: { description: "Impostos e taxas", active: true },
  });
}

/** Produto físico de teste de leitura de código de barras (EAN real). */
async function upsertBarcodeScanTestProduct(params: {
  organizationId: string;
  supplierId: string;
  categoryId: string;
  sellerId: string;
}) {
  const barcode = "7908236800643";
  const existing = await prisma.product.findFirst({
    where: { organizationId: params.organizationId, barcode },
  });

  const product =
    existing ??
    (await prisma.product.create({
      data: {
        name: "Produto teste barcode",
        sku: "EAN-7908236800643",
        barcode,
        basePrice: 12.9,
        costPrice: 8,
        stockQty: 40,
        minStockQty: 5,
        blockSaleWhenOutOfStock: true,
        productLine: "Teste scanner",
        productClassification: "RESALE",
        purchaseUnit: "UN",
        ncm: "19059090",
        nfeOrigin: 0,
        organizationId: params.organizationId,
        categoryId: params.categoryId,
        supplierId: params.supplierId,
        attributes: {
          sale_unit: "UN",
          brand: "Teste físico",
          gtin: barcode,
        },
      },
    }));

  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        name: "Produto teste barcode",
        sku: "EAN-7908236800643",
        barcode,
        basePrice: 12.9,
        stockQty: existing.stockQty > 0 ? existing.stockQty : 40,
        categoryId: params.categoryId,
        supplierId: params.supplierId,
        blockSaleWhenOutOfStock: true,
      },
    });
  }

  await prisma.sellerProduct.createMany({
    data: [{ sellerId: params.sellerId, productId: product.id }],
    skipDuplicates: true,
  });
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "seed-org" },
    update: {
      name: "Empresa Demo",
      displayName: "Empresa Demo",
      cnpj: "12345678000199",
      stateRegistration: "ISENTO",
    },
    create: {
      id: "seed-org",
      name: "Empresa Demo",
      displayName: "Empresa Demo",
      cnpj: "12345678000199",
      stateRegistration: "ISENTO",
    },
  });

  await ensureOrgRolePermissions(org.id);
  await upsertDemoCategories(org.id);
  const demoSupplier = await upsertDemoSupplier(org.id);
  await upsertFiscalDemoData(org.id);
  await upsertDemoFiscalLookups(org.id);

  const paymentConditionsSeed = [
    { code: "1", name: "A VISTA", days: 0, sortOrder: 1 },
    { code: "8", name: "BL 7 DIAS", days: 7, sortOrder: 2 },
    { code: "5", name: "BL 14 DIAS", days: 14, sortOrder: 3 },
    { code: "6", name: "BL 14/21 DIAS", days: 14, sortOrder: 4 },
    { code: "13", name: "BL 14/21/28 DIAS", days: 14, sortOrder: 5 },
    { code: "2", name: "BL 21 DIAS", days: 21, sortOrder: 6 },
    { code: "10", name: "BL 21/28", days: 21, sortOrder: 7 },
    { code: "4", name: "BL 28 DIAS", days: 28, sortOrder: 8 },
    { code: "3", name: "BL 7/14 DIAS", days: 7, sortOrder: 9 },
    { code: "7", name: "BL 7/14/21 DIAS", days: 7, sortOrder: 10 },
  ];
  for (const pc of paymentConditionsSeed) {
    await prisma.paymentCondition.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: pc.code },
      },
      create: { organizationId: org.id, ...pc },
      update: {
        name: pc.name,
        days: pc.days,
        sortOrder: pc.sortOrder,
        active: true,
      },
    });
  }

  const orderSituationsSeed = [
    {
      code: "OPEN",
      name: "Aberto",
      sortOrder: 1,
      mapsToCancel: false,
      isSystem: true,
    },
    {
      code: "SENT",
      name: "Enviado",
      sortOrder: 2,
      mapsToCancel: false,
      isSystem: true,
    },
    {
      code: "DELIVERED",
      name: "Entregue",
      sortOrder: 3,
      mapsToCancel: false,
      isSystem: true,
    },
    {
      code: "CANCELLED",
      name: "Cancelado",
      sortOrder: 4,
      mapsToCancel: true,
      isSystem: true,
    },
  ];
  for (const sit of orderSituationsSeed) {
    await prisma.orderSituation.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: sit.code },
      },
      create: { organizationId: org.id, ...sit, active: true },
      update: {
        name: sit.name,
        sortOrder: sit.sortOrder,
        mapsToCancel: sit.mapsToCancel,
        isSystem: sit.isSystem,
        active: true,
      },
    });
  }

  const adminPass = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
  const sellerPass = await bcrypt.hash(DEMO_SELLER_PASSWORD, 10);
  const managerPass = await bcrypt.hash(DEMO_MANAGER_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {
      passwordHash: adminPass,
      name: "Admin Demo",
      role: Role.ADMIN,
      organizationId: org.id,
      matricula: "ADM-001",
    },
    create: {
      email: DEMO_ADMIN_EMAIL,
      passwordHash: adminPass,
      name: "Admin Demo",
      role: Role.ADMIN,
      organizationId: org.id,
      matricula: "ADM-001",
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: DEMO_MANAGER_EMAIL },
    update: {
      passwordHash: managerPass,
      name: "Gestor Demo",
      role: Role.MANAGER,
      organizationId: org.id,
      matricula: "GES-001",
    },
    create: {
      email: DEMO_MANAGER_EMAIL,
      passwordHash: managerPass,
      name: "Gestor Demo",
      role: Role.MANAGER,
      organizationId: org.id,
      matricula: "GES-001",
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: DEMO_SELLER_EMAIL },
    update: {
      passwordHash: sellerPass,
      name: "Vendedor Demo",
      role: Role.SELLER,
      organizationId: org.id,
      matricula: "VEN-001",
    },
    create: {
      email: DEMO_SELLER_EMAIL,
      passwordHash: sellerPass,
      name: "Vendedor Demo",
      role: Role.SELLER,
      organizationId: org.id,
      matricula: "VEN-001",
    },
  });

  const seller = await prisma.seller.upsert({
    where: { userId: sellerUser.id },
    update: {
      organizationId: org.id,
      commissionPercent: 10,
      active: true,
      managerUserId: managerUser.id,
    },
    create: {
      userId: sellerUser.id,
      organizationId: org.id,
      commissionPercent: 10,
      active: true,
      managerUserId: managerUser.id,
    },
  });

  const demoTeam = await prisma.salesTeam.upsert({
    where: { leaderSellerId: seller.id },
    create: {
      name: "Equipe Centro",
      organizationId: org.id,
      leaderSellerId: seller.id,
    },
    update: {
      name: "Equipe Centro",
      organizationId: org.id,
    },
  });
  await prisma.seller.update({
    where: { id: seller.id },
    data: { teamId: demoTeam.id },
  });

  console.log("Contas demo (senhas atualizadas):");
  console.log(`  Admin:    ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
  console.log(`  Gestor:   ${DEMO_MANAGER_EMAIL} / ${DEMO_MANAGER_PASSWORD}`);
  console.log(`  Vendedor: ${DEMO_SELLER_EMAIL} / ${DEMO_SELLER_PASSWORD}`);
  console.log(
    "  Equipe demo: Equipe Centro (líder: vendedor@demo.com — acesso web limitado)",
  );
  console.log(
    "  Fornecedor demo: BISCOITOS CROCANTE (BISC-CROC) — CNPJ 49.932.607/0001-07",
  );

  try {
    await upsertRouteDemoCustomer();
  } catch (e) {
    console.warn(
      "Seed cliente de rota (Googleplex):",
      e instanceof Error ? e.message : e,
    );
  }

  const productCount = await prisma.product.count({
    where: { organizationId: org.id },
  });
  if (productCount > 0) {
    await prisma.product.updateMany({
      where: { organizationId: org.id, supplierId: null },
      data: { supplierId: demoSupplier.id },
    });
    const catSnackExisting = await prisma.productCategory.findUnique({
      where: {
        organizationId_code: { organizationId: org.id, code: "SNACK" },
      },
    });
    if (catSnackExisting) {
      await upsertBarcodeScanTestProduct({
        organizationId: org.id,
        supplierId: demoSupplier.id,
        categoryId: catSnackExisting.id,
        sellerId: seller.id,
      });
    }
    console.log(
      "Dados de exemplo (produtos) já existem — categorias e fornecedor demo garantidos.",
    );
    console.log(
      "  Produto teste barcode: 7908236800643 (liberado ao vendedor demo)",
    );
    return;
  }

  const catGeneral = await prisma.productCategory.findUniqueOrThrow({
    where: {
      organizationId_code: { organizationId: org.id, code: "GENERAL" },
    },
  });
  const catConsumable = await prisma.productCategory.findUniqueOrThrow({
    where: {
      organizationId_code: { organizationId: org.id, code: "CONSUMABLE" },
    },
  });

  const catSnack = await prisma.productCategory.findUniqueOrThrow({
    where: {
      organizationId_code: { organizationId: org.id, code: "SNACK" },
    },
  });

  const pt = await prisma.priceTable.create({
    data: {
      name: "Tabela Padrão",
      organizationId: org.id,
    },
  });

  const p1 = await prisma.product.create({
    data: {
      name: "Produto A",
      sku: "PA-001",
      barcode: "7891234567890",
      basePrice: 100,
      costPrice: 72,
      factoryPrice: 85,
      maxSalePrice: 120,
      minSaleUnitPrice: 90,
      maxSellerDiscountPercent: 8,
      freightAmount: 2.5,
      commissionPercent: 5,
      collectionCommissionPercent: 1.5,
      stockQty: 24,
      minStockQty: 6,
      maxStockQty: 200,
      blockSaleWhenOutOfStock: true,
      productLine: "Linha 1",
      productClassification: "RESALE",
      purchaseUnit: "CX",
      standardPurchaseBoxQty: 12,
      grossWeightKg: 1.2,
      netWeightKg: 1.0,
      stockAddress: "A-01-03",
      maxDailyQtyPerSeller: 50,
      maxDailyQtyPerCustomer: 20,
      ncm: "19059090",
      nfeOrigin: 0,
      fiscalClass: "Revenda",
      pisCofinsClassification: "Neutro",
      cstPis: "01",
      ipiPercent: 0,
      icmsCostPercent: 12,
      organizationId: org.id,
      categoryId: catSnack.id,
      supplierId: demoSupplier.id,
      attributes: {
        sale_unit: "UN",
        net_content: "1 un",
        brand: "Marca Demo",
        gtin: "7891234567890",
        origin_country: "BR",
      },
    },
  });
  const p2 = await prisma.product.create({
    data: {
      name: "Produto B",
      sku: "PB-002",
      barcode: "7899876543210",
      basePrice: 250.5,
      costPrice: 180,
      factoryPrice: 210,
      maxSalePrice: 280,
      minSaleUnitPrice: 220,
      maxSellerDiscountPercent: 5,
      commissionPercent: 8,
      stockQty: 12,
      minStockQty: 4,
      blockSaleWhenOutOfStock: true,
      productLine: "Linha 2",
      productClassification: "RESALE",
      purchaseUnit: "UN",
      standardPurchaseBoxQty: 24,
      netWeightKg: 0.5,
      stockAddress: "B-02-01",
      ncm: "22021000",
      nfeOrigin: 0,
      organizationId: org.id,
      categoryId: catConsumable.id,
      supplierId: demoSupplier.id,
      attributes: {
        sale_unit: "UN",
        net_content: "500 ml",
        batch_traceability: false,
      },
    },
  });

  await prisma.priceTableItem.createMany({
    data: [
      { priceTableId: pt.id, productId: p1.id, price: 95 },
      { priceTableId: pt.id, productId: p2.id, price: 240 },
    ],
    skipDuplicates: true,
  });

  await prisma.sellerProduct.createMany({
    data: [
      { sellerId: seller.id, productId: p1.id },
      { sellerId: seller.id, productId: p2.id },
    ],
    skipDuplicates: true,
  });

  await upsertBarcodeScanTestProduct({
    organizationId: org.id,
    supplierId: demoSupplier.id,
    categoryId: catSnack.id,
    sellerId: seller.id,
  });

  await prisma.productPromotion.createMany({
    data: [
      {
        organizationId: org.id,
        productId: p1.id,
        scope: "PRODUCT_GLOBAL",
        kind: "PERCENT_OFF",
        value: 5,
        label: "Seed: 5% para todos neste produto",
        priority: 0,
      },
      {
        organizationId: org.id,
        productId: p2.id,
        scope: "SELLER",
        sellerId: seller.id,
        kind: "SALE_PRICE",
        value: 199,
        label: "Seed: preço especial só para o vendedor demo",
        priority: 1,
      },
    ],
  });

  const customer = await prisma.customer.create({
    data: {
      name: "Cliente Exemplo",
      email: "cliente@exemplo.com",
      organizationId: org.id,
      sellerId: seller.id,
      documentType: "CNPJ",
      cnpj: "11444777000161",
      legalName: "Cliente Exemplo Ltda",
      tradeName: "Cliente Exemplo",
      stateRegistration: "ISENTO",
      street: "Av. Paulista",
      number: "1000",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      cep: "01310100",
      cityIbgeCode: "3550308",
    },
  });

  await prisma.order.create({
    data: {
      organizationId: org.id,
      sellerId: seller.id,
      customerId: customer.id,
      status: "CONFIRMED",
      totalAmount: 180.5,
      items: {
        create: [
          {
            productId: p1.id,
            quantity: 2,
            unitPrice: 90.25,
            productName: p1.name,
          },
        ],
      },
    },
  });

  await prisma.notification.create({
    data: {
      userId: sellerUser.id,
      title: "Bem-vindo",
      body: "Seu acesso ao app PedixPro está ativo.",
    },
  });

  await upsertFiscalDemoData(org.id);

  console.log("Seed de produtos/pedidos demo concluído.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
