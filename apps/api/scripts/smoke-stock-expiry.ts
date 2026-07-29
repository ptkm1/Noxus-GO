/**
 * Smoke: PDF com productIds + dedupe do job (2 execuções).
 */
import { prisma } from "../src/db.js";
import { buildStockPdf } from "../src/services/reports/stock-pdf.js";
import { runStockExpiryAlerts } from "../src/services/stock-expiry-alerts.js";

async function main() {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!org) throw new Error("sem org");
  const product = await prisma.product.findFirst({
    where: { organizationId: org.id },
  });
  if (!product) throw new Error("sem produto");

  const product2 = await prisma.product.findFirst({
    where: { organizationId: org.id, id: { not: product.id } },
  });

  const expires = new Date();
  expires.setHours(0, 0, 0, 0);
  expires.setDate(expires.getDate() + 5);

  const lot = await prisma.productLot.upsert({
    where: {
      productId_lotCode: { productId: product.id, lotCode: "SMOKE-EXPIRY" },
    },
    create: {
      organizationId: org.id,
      productId: product.id,
      lotCode: "SMOKE-EXPIRY",
      expiresAt: expires,
      qty: 3,
    },
    update: { expiresAt: expires, qty: 3 },
  });

  await prisma.stockExpiryAlert.deleteMany({ where: { lotId: lot.id } });

  const first = await runStockExpiryAlerts({ organizationId: org.id });
  const second = await runStockExpiryAlerts({ organizationId: org.id });
  console.log("1ª", first);
  console.log("2ª", second);

  if (first.newAlerts < 1) throw new Error("esperava newAlerts na 1ª");
  if (second.newAlerts !== 0) throw new Error("dedupe falhou");

  const ids = product2 ? [product.id, product2.id] : [product.id];
  const pdf = await buildStockPdf({
    organizationId: org.id,
    productIds: ids,
  });
  console.log("PDF bytes", pdf.length, "productIds", ids.length);

  await prisma.stockExpiryAlert.deleteMany({ where: { lotId: lot.id } });
  await prisma.productLot.delete({ where: { id: lot.id } });
  console.log("OK smoke PDF + dedupe");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
