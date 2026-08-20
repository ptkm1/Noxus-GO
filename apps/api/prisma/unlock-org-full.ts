import { prisma } from "../src/db.js";
import { ensureOrgSubscription } from "../src/services/billing/subscription.js";
import { ensureDefaultOrderSituations } from "../src/services/order-situations.js";
import {
  ensureOrgRolePermissions,
  setOrgEnabledRoles,
} from "../src/services/role-permissions.js";
import { CATEGORY_SCHEMA_BY_CODE } from "./category-schemas.js";
import { upsertPimentinhaSaltbits } from "./seed-pimentinha-saltbits.js";

const DEFAULT_EMAIL = "mascarenhas_breno@hotmail.com";

const CATEGORIES = [
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

const PAYMENT_CONDITIONS = [
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
] as const;

async function upsertCategories(organizationId: string) {
  for (const e of CATEGORIES) {
    await prisma.productCategory.upsert({
      where: {
        organizationId_code: { organizationId, code: e.code },
      },
      update: { name: e.name, attributeSchema: [...e.schema] },
      create: {
        organizationId,
        code: e.code,
        name: e.name,
        attributeSchema: [...e.schema],
      },
    });
  }
}

async function upsertPaymentConditions(organizationId: string) {
  for (const pc of PAYMENT_CONDITIONS) {
    await prisma.paymentCondition.upsert({
      where: {
        organizationId_code: { organizationId, code: pc.code },
      },
      create: { organizationId, ...pc },
      update: {
        name: pc.name,
        days: pc.days,
        sortOrder: pc.sortOrder,
        active: true,
      },
    });
  }
}

async function upsertFiscalLookups(organizationId: string) {
  await prisma.costCenter.upsert({
    where: { organizationId_code: { organizationId, code: "ADM" } },
    create: { organizationId, code: "ADM", name: "Administrativo" },
    update: { name: "Administrativo", active: true },
  });
  await prisma.expenseHistory.upsert({
    where: { organizationId_code: { organizationId, code: "IMPOSTO" } },
    create: {
      organizationId,
      code: "IMPOSTO",
      description: "Impostos e taxas",
    },
    update: { description: "Impostos e taxas", active: true },
  });
}

export async function unlockOrgFullAccess(email: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!user) {
    throw new Error(`Usuário não encontrado: ${email}`);
  }

  const organizationId = user.organizationId;
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 10);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      accessStatus: "ACTIVE",
      creditPolicy: "WARN_ONLY",
      sellerShowUnassignedCustomers: true,
      sellerCanEditQueuedSales: true,
      customerRegistrationMode: "AUTO",
      orderSyncMode: "AUTO",
    },
  });

  await setOrgEnabledRoles(organizationId, [
    "ADMIN",
    "MANAGER",
    "SELLER",
    "SUPERVISOR",
  ]);

  await ensureOrgSubscription(organizationId, { planId: "pro" });
  await prisma.organizationSubscription.update({
    where: { organizationId },
    data: {
      planId: "pro",
      status: "ACTIVE",
      provider: "none",
      cancelAtPeriodEnd: false,
      gracePeriodEndsAt: null,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    },
  });

  await ensureOrgRolePermissions(organizationId);
  await ensureDefaultOrderSituations(organizationId);
  await upsertCategories(organizationId);
  await upsertPaymentConditions(organizationId);
  await upsertFiscalLookups(organizationId);
  await upsertPimentinhaSaltbits(organizationId);

  console.log("Acesso total liberado:");
  console.log(`  usuário:  ${user.email} (${user.role})`);
  console.log(`  org:      ${user.organization.name} (${organizationId})`);
  console.log("  plano:    Pro ACTIVE (sem teto de usuários/vendedores)");
  console.log("  papéis:   ADMIN, MANAGER, SELLER, SUPERVISOR");
  console.log("  extras:   categorias e condições de pagamento");
  console.log(
    "  fiscal:   emitente NÃO é preenchido (usar CNPJ real em Faturamento)",
  );
}

async function main() {
  const email =
    process.argv.slice(2).find((a) => a.includes("@")) ?? DEFAULT_EMAIL;
  await unlockOrgFullAccess(email);
}

const isDirectRun = process.argv[1]?.includes("unlock-org-full");
if (isDirectRun) {
  main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      void prisma.$disconnect();
      process.exit(1);
    });
}
