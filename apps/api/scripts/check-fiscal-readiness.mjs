import { prisma } from "../src/db.js";

const order = await prisma.order.findFirst({
  where: { status: "CONFIRMED" },
  include: {
    customer: true,
    items: { include: { product: { include: { ncm: true } } } },
  },
  orderBy: { createdAt: "desc" },
});

if (!order) {
  console.log("Nenhum pedido confirmado");
  process.exit(0);
}

const config = await prisma.organizationFiscalConfig.findUnique({
  where: { organizationId: order.organizationId },
});

const issues: string[] = [];
if (!config) issues.push("Configuração fiscal não cadastrada");
else {
  if (!config.cnpj?.trim()) issues.push("CNPJ do emitente");
  if (!config.uf?.trim()) issues.push("UF do emitente");
}
if (!order.customer?.document?.trim()) issues.push("Cliente sem CNPJ/CPF");
if (!order.customer?.street?.trim() || !order.customer?.city?.trim() || !order.customer?.state?.trim()) {
  issues.push("Cliente sem endereço completo");
}
for (const item of order.items) {
  const p = item.product;
  const missing: string[] = [];
  if (!p.ncmId) missing.push("NCM");
  if (p.fiscalOrigin == null) missing.push("origem");
  if (!p.fiscalUnit?.trim()) missing.push("unidade");
  if (missing.length) issues.push(`Produto "${p.name}": falta ${missing.join(", ")}`);
}

console.log("ISSUES:", issues.join("; ") || "nenhuma");
console.log(JSON.stringify({ orderId: order.id, customer: order.customer, config, products: order.items.map((i) => i.product) }, null, 2));
await prisma.$disconnect();
