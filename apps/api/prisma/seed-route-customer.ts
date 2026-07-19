import { prisma } from "../src/db.js";

/** Cliente e vendedor do teu ambiente (ajusta aqui se mudar). */
export const ROUTE_DEMO_CUSTOMER_ID = "cmpa81211000g6j1wbpriydcc";
export const ROUTE_DEMO_SELLER_ID = "cmrbbofny0009p0ckgkirtkf4";

/** Googleplex, Mountain View CA — área do screenshot de teste do mapa. */
const DEMO_LATITUDE = 37.422;
const DEMO_LONGITUDE = -122.084;

/**
 * Garante cliente com GPS na carteira do vendedor para testar aba Rota / mapa.
 * Idempotente (upsert por id).
 */
export async function upsertRouteDemoCustomer(): Promise<void> {
  const seller = await prisma.seller.findUnique({
    where: { id: ROUTE_DEMO_SELLER_ID },
    select: {
      id: true,
      organizationId: true,
      user: { select: { name: true } },
    },
  });

  if (!seller) {
    throw new Error(
      `Vendedor ${ROUTE_DEMO_SELLER_ID} não encontrado. Confirme o id ou rode o seed da org primeiro.`,
    );
  }

  const customer = await prisma.customer.upsert({
    where: { id: ROUTE_DEMO_CUSTOMER_ID },
    update: {
      name: "Cliente Googleplex (demo rota)",
      email: "googleplex.demo@pedidos.local",
      organizationId: seller.organizationId,
      sellerId: seller.id,
      latitude: DEMO_LATITUDE,
      longitude: DEMO_LONGITUDE,
      addressNote: "Mountain View, CA — Googleplex (seed para teste de mapa)",
    },
    create: {
      id: ROUTE_DEMO_CUSTOMER_ID,
      name: "Cliente Googleplex (demo rota)",
      email: "googleplex.demo@pedidos.local",
      organizationId: seller.organizationId,
      sellerId: seller.id,
      latitude: DEMO_LATITUDE,
      longitude: DEMO_LONGITUDE,
      addressNote: "Mountain View, CA — Googleplex (seed para teste de mapa)",
    },
  });

  console.log("Cliente de rota (mapa):");
  console.log(`  id:      ${customer.id}`);
  console.log(`  nome:    ${customer.name}`);
  console.log(`  vendedor: ${seller.user.name} (${seller.id})`);
  console.log(`  GPS:     ${DEMO_LATITUDE}, ${DEMO_LONGITUDE}`);
}

async function main() {
  await upsertRouteDemoCustomer();
}

const isDirectRun = process.argv[1]?.includes("seed-route-customer");
if (isDirectRun) {
  main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      void prisma.$disconnect();
      process.exit(1);
    });
}
