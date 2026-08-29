import { prisma } from "../src/db.js";
import { buildCustomersPdf } from "../src/services/reports/customers-pdf.js";
import { buildOrderItemsPdf } from "../src/services/reports/order-items-pdf.js";
import { buildOrdersPdf } from "../src/services/reports/orders-pdf.js";
import { buildStockPdf } from "../src/services/reports/stock-pdf.js";

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error("Nenhuma organização — rode pnpm db:seed");
    process.exit(1);
  }
  const id = org.id;
  const [customers, orders, romaneio, items, stock, stockValue] =
    await Promise.all([
    buildCustomersPdf({ organizationId: id }),
    buildOrdersPdf({ organizationId: id, romaneio: false }),
    buildOrdersPdf({ organizationId: id, romaneio: true }),
    buildOrderItemsPdf({ organizationId: id, groupItems: true }),
    buildStockPdf({ organizationId: id }),
    buildStockPdf({ organizationId: id, stockValueBasis: "last_cost" }),
  ]);

  for (const [name, buf] of [
    ["customers", customers],
    ["orders", orders],
    ["romaneio", romaneio],
    ["items", items],
    ["stock", stock],
    ["stock-value", stockValue],
  ] as const) {
    if (buf.length < 100 || buf.subarray(0, 4).toString() !== "%PDF") {
      throw new Error(`${name} não parece PDF válido (${buf.length} bytes)`);
    }
    console.log(`OK ${name}: ${buf.length} bytes`);
  }
  console.log("smoke-reports-pdf-e2e: OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
