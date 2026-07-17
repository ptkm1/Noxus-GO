import { prisma } from "../src/db.js";
import { buildOutboundInvoiceFromOrder } from "../src/services/fiscal-outbound.js";

const order = await prisma.order.findFirst({
  where: { status: "CONFIRMED" },
  orderBy: { createdAt: "desc" },
});
if (!order) {
  console.log("Sem pedido confirmado");
  process.exit(0);
}

const result = await buildOutboundInvoiceFromOrder(order.organizationId, order.id);
console.log(result.ok ? "OK - emissão funcionaria" : "FALHA: " + result.issues.map((i) => i.message).join("; "));
await prisma.$disconnect();
