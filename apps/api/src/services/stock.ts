import type { Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "../db.js";

export async function getOrCreateProductStock(
  organizationId: string,
  productId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const existing = await tx.productStock.findUnique({ where: { productId } });
  if (existing) return existing;
  return tx.productStock.create({
    data: { organizationId, productId, quantityOnHand: 0 },
  });
}

export async function applyStockMovement(input: {
  organizationId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdByUserId?: string;
}) {
  if (input.type === "MANUAL_ADJUST") {
    if (input.quantity < 0) throw new Error("Novo saldo não pode ser negativo");
  } else if (input.quantity <= 0) {
    throw new Error("Quantidade deve ser positiva");
  }

  return prisma.$transaction(async (tx) => {
    const stock = await getOrCreateProductStock(
      input.organizationId,
      input.productId,
      tx,
    );
    const current = Number(stock.quantityOnHand);
    let delta = input.quantity;
    if (input.type === "MANUAL_OUT" || input.type === "OUTBOUND_INVOICE") {
      delta = -input.quantity;
    } else if (input.type === "MANUAL_ADJUST" || input.type === "ADJUST") {
      delta = input.quantity - current;
    }
    const next = current + delta;
    if (next < 0) throw new Error("Saldo insuficiente");

    await tx.productStock.update({
      where: { id: stock.id },
      data: { quantityOnHand: next },
    });

    // Mantém Product.stockQty sincronizado para vendas/catálogo.
    const balanceAfter = Math.max(0, Math.floor(next));
    await tx.product.update({
      where: { id: input.productId },
      data: { stockQty: balanceAfter },
    });

    const reasonParts = [
      input.notes,
      input.referenceType && input.referenceId
        ? `${input.referenceType}:${input.referenceId}`
        : input.referenceType,
    ].filter(Boolean);

    return tx.stockMovement.create({
      data: {
        organizationId: input.organizationId,
        productId: input.productId,
        type: input.type,
        qtyDelta: Math.trunc(delta),
        balanceAfter,
        userId: input.createdByUserId,
        reason: reasonParts.length > 0 ? reasonParts.join(" — ") : null,
      },
    });
  });
}

export async function applyInboundInvoiceStock(
  organizationId: string,
  fiscalInvoiceId: string,
  items: { productId: string; quantity: number }[],
  userId?: string,
) {
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    await applyStockMovement({
      organizationId,
      productId: item.productId,
      type: "INBOUND_INVOICE",
      quantity: item.quantity,
      referenceType: "FiscalInvoice",
      referenceId: fiscalInvoiceId,
      notes: "Entrada automática via NF-e",
      createdByUserId: userId,
    });
  }
}

export async function reverseInboundInvoiceStock(
  organizationId: string,
  fiscalInvoiceId: string,
  items: { productId: string; quantity: number }[],
  userId?: string,
) {
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    await applyStockMovement({
      organizationId,
      productId: item.productId,
      type: "MANUAL_OUT",
      quantity: item.quantity,
      referenceType: "FiscalInvoice",
      referenceId: fiscalInvoiceId,
      notes: "Estorno por cancelamento de NF-e de entrada",
      createdByUserId: userId,
    });
  }
}
