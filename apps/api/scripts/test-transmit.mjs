import { prisma } from "../src/db.js";
import { transmitOutboundInvoice } from "../src/services/fiscal-outbound.js";

const invoice = await prisma.fiscalInvoice.findFirst({
  where: { direction: "OUTBOUND", status: "DRAFT" },
  orderBy: { createdAt: "desc" },
});
if (!invoice) {
  console.log("Sem NF-e em rascunho");
  process.exit(0);
}

const config = await prisma.organizationFiscalConfig.findUnique({
  where: { organizationId: invoice.organizationId },
});
console.log("invoice:", invoice.id);
console.log("config cert:", !!config?.certificatePfxEncrypted);
console.log("FISCAL_ENCRYPTION_KEY set:", !!process.env.FISCAL_ENCRYPTION_KEY?.trim());

try {
  const result = await transmitOutboundInvoice(invoice.organizationId, invoice.id);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("THROW:", e);
}
await prisma.$disconnect();
