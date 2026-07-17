import type { OrderStatus } from "@prisma/client";
import { prisma } from "../db.js";
import { writeAuditLog } from "./audit-log.js";
import { consumeLotsFefo } from "./stock-ledger.js";

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

type OrderLine = { productId: string; quantity: number };

export async function assertSufficientStock(
  organizationId: string,
  items: OrderLine[],
): Promise<void> {
  if (items.length === 0) return;

  const qtyByProduct = new Map<string, number>();
  for (const item of items) {
    qtyByProduct.set(
      item.productId,
      (qtyByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }

  const products = await prisma.product.findMany({
    where: {
      organizationId,
      id: { in: [...qtyByProduct.keys()] },
    },
    select: {
      id: true,
      name: true,
      stockQty: true,
      blockSaleWhenOutOfStock: true,
    },
  });

  const byId = new Map(products.map((p) => [p.id, p]));
  const errors: string[] = [];

  for (const [productId, qty] of qtyByProduct) {
    const p = byId.get(productId);
    if (!p?.blockSaleWhenOutOfStock) continue;
    if (p.stockQty < qty) {
      errors.push(
        `Estoque insuficiente para "${p.name}" (disponível: ${p.stockQty}, pedido: ${qty}).`,
      );
    }
  }

  if (errors.length > 0) throw new StockError(errors.join(" "));
}

export async function applyStockOnStatusChange(
  orderId: string,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  actorUserId?: string | null,
): Promise<void> {
  if (fromStatus === toStatus) return;

  const confirming = toStatus === "CONFIRMED" && fromStatus !== "CONFIRMED";
  const cancelling = toStatus === "CANCELLED" && fromStatus === "CONFIRMED";
  if (!confirming && !cancelling) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      seller: { select: { userId: true } },
    },
  });
  if (!order) return;

  const userId = actorUserId ?? order.seller.userId;

  if (confirming) {
    await assertSufficientStock(
      order.organizationId,
      order.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stockQty: true, name: true },
      });
      if (!product) continue;

      if (confirming) {
        const newQty = product.stockQty - item.quantity;
        if (newQty < 0) {
          throw new StockError(`Estoque insuficiente para "${product.name}".`);
        }
        await consumeLotsFefo(tx, {
          organizationId: order.organizationId,
          productId: item.productId,
          qty: item.quantity,
          type: "SALE",
          userId,
          orderId: order.id,
          startingBalance: product.stockQty,
        });
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: newQty },
        });
      } else {
        const newQty = product.stockQty + item.quantity;
        await consumeLotsFefo(tx, {
          organizationId: order.organizationId,
          productId: item.productId,
          qty: item.quantity,
          type: "SALE_REVERSAL",
          userId,
          orderId: order.id,
          startingBalance: product.stockQty,
        });
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: newQty },
        });
      }
    }

    const actor = userId
      ? await tx.user.findUnique({
          where: { id: userId },
          select: { matricula: true },
        })
      : null;

    await writeAuditLog(
      {
        organizationId: order.organizationId,
        userId: userId ?? null,
        userMatricula: actor?.matricula ?? null,
        action: confirming ? "stock.sale" : "stock.sale_reversal",
        entityType: "Order",
        entityId: order.id,
        metadata: {
          fromStatus,
          toStatus,
          itemCount: order.items.length,
        },
      },
      tx,
    );
  });
}
