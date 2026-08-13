import {
  EXPEDITION_SITUATION_CODES,
  findProductByBarcode,
} from "@pedidos/shared";
import { Prisma } from "@prisma/client";
import type { AccessPayload } from "../auth/jwt.js";
import { orderScopeWhere } from "../auth/org-roles.js";
import { prisma } from "../db.js";
import { AUDIT_ACTION, AUDIT_ENTITY, auditFromAuth } from "./audit-log.js";
import { findOrgSituationId } from "./order-situations.js";

export class ExpeditionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "ExpeditionError";
  }
}

const productSelect = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  fiscalGtin: true,
} as const;

function progressOf(
  items: Array<{ requestedQty: number; checkedQty: number }>,
) {
  const requestedUnits = items.reduce((s, i) => s + i.requestedQty, 0);
  const checkedUnits = items.reduce((s, i) => s + i.checkedQty, 0);
  const percent =
    requestedUnits <= 0
      ? 100
      : Math.min(100, Math.round((checkedUnits / requestedUnits) * 100));
  const complete =
    items.length > 0 && items.every((i) => i.checkedQty >= i.requestedQty);
  return { requestedUnits, checkedUnits, percent, complete };
}

async function setOrderSituationId(
  tx: { order: { update: Prisma.TransactionClient["order"]["update"] } },
  orderId: string,
  situationId: string | null,
) {
  if (!situationId) return;
  await tx.order.update({
    where: { id: orderId },
    data: { situationId },
  });
}

export async function listExpeditionQueue(params: {
  auth: AccessPayload;
  status?: "DRAFT" | "CONFIRMED" | "CANCELLED" | "PENDING_CREDIT_APPROVAL";
  situationCode?: string;
  orderNumber?: number;
  city?: string;
  tradeName?: string;
  from?: string;
  to?: string;
}) {
  await findOrgSituationId(params.auth.organizationId, "PICKING");
  const where: Prisma.OrderWhereInput = {
    ...orderScopeWhere(params.auth),
    isQuote: false,
  };
  if (params.status) where.status = params.status;
  else where.status = "CONFIRMED";

  if (params.situationCode) {
    const sid = await findOrgSituationId(
      params.auth.organizationId,
      params.situationCode,
    );
    if (sid && params.situationCode === EXPEDITION_SITUATION_CODES.WAITING) {
      where.OR = [{ situationId: sid }, { situationId: null }];
    } else if (sid) {
      where.situationId = sid;
    }
  }
  if (params.orderNumber) where.orderNumber = params.orderNumber;
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = new Date(params.from);
    if (params.to) where.createdAt.lte = new Date(params.to);
  }
  const customerAnd: Prisma.CustomerWhereInput[] = [];
  if (params.city?.trim()) {
    customerAnd.push({
      city: { contains: params.city.trim(), mode: "insensitive" },
    });
  }
  if (params.tradeName?.trim()) {
    customerAnd.push({
      OR: [
        {
          tradeName: { contains: params.tradeName.trim(), mode: "insensitive" },
        },
        { name: { contains: params.tradeName.trim(), mode: "insensitive" } },
        {
          legalName: { contains: params.tradeName.trim(), mode: "insensitive" },
        },
      ],
    });
  }
  if (customerAnd.length === 1) where.customer = customerAnd[0];
  else if (customerAnd.length > 1) where.customer = { AND: customerAnd };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      customer: {
        select: {
          name: true,
          tradeName: true,
          legalName: true,
          city: true,
          state: true,
        },
      },
      situation: { select: { id: true, code: true, name: true } },
      items: { select: { id: true, quantity: true } },
      expedition: {
        select: {
          id: true,
          status: true,
          volumeQty: true,
          startedAt: true,
          finishedAt: true,
          startedBy: { select: { id: true, name: true } },
          finishedBy: { select: { id: true, name: true } },
          items: { select: { requestedQty: true, checkedQty: true } },
        },
      },
    },
  });

  return orders.map((o) => {
    const units = o.items.reduce((s, i) => s + i.quantity, 0);
    const prog = o.expedition
      ? progressOf(o.expedition.items)
      : { requestedUnits: units, checkedUnits: 0, percent: 0, complete: false };
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      createdAt: o.createdAt,
      totalAmount: o.totalAmount,
      customer: o.customer,
      situation: o.situation,
      itemCount: o.items.length,
      unitCount: units,
      expedition: o.expedition
        ? {
            id: o.expedition.id,
            status: o.expedition.status,
            volumeQty: o.expedition.volumeQty,
            startedAt: o.expedition.startedAt,
            finishedAt: o.expedition.finishedAt,
            startedBy: o.expedition.startedBy,
            finishedBy: o.expedition.finishedBy,
            progress: prog,
          }
        : null,
    };
  });
}

const detailInclude = {
  customer: true,
  situation: { select: { id: true, code: true, name: true } },
  items: {
    include: { product: { select: productSelect } },
  },
  expedition: {
    include: {
      startedBy: { select: { id: true, name: true } },
      finishedBy: { select: { id: true, name: true } },
      items: true,
      events: {
        orderBy: { createdAt: "desc" as const },
        take: 80,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  },
} satisfies Prisma.OrderInclude;

function serializeDetail(
  order: Prisma.OrderGetPayload<{ include: typeof detailInclude }>,
) {
  const exp = order.expedition;
  const lines = order.items.map((it) => {
    const expItem = exp?.items.find((e) => e.orderItemId === it.id);
    const requested = expItem?.requestedQty ?? it.quantity;
    const checked = expItem?.checkedQty ?? 0;
    let lineStatus: "pending" | "partial" | "done" = "pending";
    if (checked >= requested && requested > 0) lineStatus = "done";
    else if (checked > 0) lineStatus = "partial";
    return {
      orderItemId: it.id,
      productId: it.productId,
      productName: it.productName,
      sku: it.product.sku,
      barcode: it.product.barcode,
      requestedQty: requested,
      checkedQty: checked,
      lineStatus,
    };
  });
  const prog = progressOf(lines);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    totalAmount: order.totalAmount,
    customer: order.customer,
    situation: order.situation,
    locked: exp?.status === "COMPLETED",
    expedition: exp
      ? {
          id: exp.id,
          status: exp.status,
          volumeQty: exp.volumeQty,
          startedAt: exp.startedAt,
          startedBy: exp.startedBy,
          finishedAt: exp.finishedAt,
          finishedBy: exp.finishedBy,
          events: exp.events,
        }
      : null,
    items: lines,
    progress: prog,
  };
}

export async function getExpeditionOrder(auth: AccessPayload, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderScopeWhere(auth) },
    include: detailInclude,
  });
  if (!order) {
    throw new ExpeditionError("Pedido não encontrado", "NOT_FOUND", 404);
  }
  return serializeDetail(order);
}

export async function startExpedition(auth: AccessPayload, orderId: string) {
  const existing = await prisma.order.findFirst({
    where: { id: orderId, ...orderScopeWhere(auth) },
    include: { items: true, expedition: true },
  });
  if (!existing) {
    throw new ExpeditionError("Pedido não encontrado", "NOT_FOUND", 404);
  }
  if (existing.status !== "CONFIRMED") {
    throw new ExpeditionError(
      "Só é possível separar pedidos confirmados.",
      "INVALID_STATUS",
    );
  }
  if (existing.expedition?.status === "COMPLETED") {
    throw new ExpeditionError(
      "Este pedido já foi conferido e finalizado.",
      "LOCKED",
      409,
    );
  }
  if (existing.expedition) {
    return getExpeditionOrder(auth, orderId);
  }
  if (existing.items.length === 0) {
    throw new ExpeditionError("Pedido sem itens.", "EMPTY");
  }

  const pickingId = await findOrgSituationId(
    auth.organizationId,
    EXPEDITION_SITUATION_CODES.PICKING,
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.orderExpedition.create({
        data: {
          organizationId: auth.organizationId,
          orderId,
          startedByUserId: auth.sub,
          items: {
            create: existing.items.map((it) => ({
              orderItemId: it.id,
              productId: it.productId,
              requestedQty: it.quantity,
            })),
          },
          events: {
            create: {
              userId: auth.sub,
              type: "START",
            },
          },
        },
      });
      await setOrderSituationId(tx, orderId, pickingId);
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return getExpeditionOrder(auth, orderId);
    }
    throw e;
  }

  await auditFromAuth(auth, {
    action: AUDIT_ACTION.EXPEDITION_START,
    entityType: AUDIT_ENTITY.Order,
    entityId: orderId,
  });

  return getExpeditionOrder(auth, orderId);
}

async function loadOpenExpedition(auth: AccessPayload, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderScopeWhere(auth) },
    include: {
      expedition: {
        include: {
          items: {
            include: {
              orderItem: { include: { product: { select: productSelect } } },
            },
          },
        },
      },
    },
  });
  if (!order?.expedition) {
    throw new ExpeditionError(
      "Inicie a separação antes de conferir.",
      "NOT_STARTED",
      409,
    );
  }
  if (order.expedition.status === "COMPLETED") {
    throw new ExpeditionError(
      "Este pedido já foi conferido e finalizado.",
      "LOCKED",
      409,
    );
  }
  return order.expedition;
}

export async function scanExpeditionItem(params: {
  auth: AccessPayload;
  orderId: string;
  barcode: string;
}) {
  const raw = params.barcode.trim();
  if (!raw) {
    throw new ExpeditionError("Informe o código de barras.", "EMPTY_CODE");
  }
  const exp = await loadOpenExpedition(params.auth, params.orderId);

  const catalog = exp.items.map((i) => i.orderItem.product);
  const inOrder = findProductByBarcode(catalog, raw);

  if (!inOrder) {
    const trimmed = raw.trim();
    const digits = trimmed.replace(/\D/g, "");
    const variants = [
      ...new Set(
        [
          trimmed,
          digits,
          digits.length === 12 ? `0${digits}` : "",
          digits.length === 13 && digits.startsWith("0") ? digits.slice(1) : "",
        ].filter(Boolean),
      ),
    ];
    const orgHit = await prisma.product.findFirst({
      where: {
        organizationId: params.auth.organizationId,
        OR: [
          { barcode: { in: variants } },
          { sku: { in: variants } },
          { fiscalGtin: { in: variants } },
        ],
      },
      select: { id: true },
    });
    const known = Boolean(orgHit);
    const type = known ? "REJECT_WRONG" : "REJECT_UNKNOWN";
    await prisma.orderExpeditionEvent.create({
      data: {
        expeditionId: exp.id,
        userId: params.auth.sub,
        type,
        barcode: raw,
      },
    });
    throw new ExpeditionError(
      known
        ? "Produto não pertence a este pedido."
        : "Código de barras não encontrado.",
      known ? "WRONG_PRODUCT" : "UNKNOWN_BARCODE",
    );
  }

  const line =
    exp.items.find(
      (i) => i.productId === inOrder.id && i.checkedQty < i.requestedQty,
    ) ?? exp.items.find((i) => i.productId === inOrder.id);

  if (!line) {
    throw new ExpeditionError(
      "Produto não pertence a este pedido.",
      "WRONG_PRODUCT",
    );
  }

  const updated = await prisma.orderExpeditionItem.updateMany({
    where: {
      id: line.id,
      checkedQty: { lt: line.requestedQty },
    },
    data: { checkedQty: { increment: 1 } },
  });

  if (updated.count === 0) {
    await prisma.orderExpeditionEvent.create({
      data: {
        expeditionId: exp.id,
        userId: params.auth.sub,
        type: "REJECT_OVER",
        orderItemId: line.orderItemId,
        productId: line.productId,
        barcode: raw,
      },
    });
    throw new ExpeditionError(
      "Quantidade já conferida. Este produto não possui mais unidades pendentes.",
      "OVER_QTY",
    );
  }

  await prisma.orderExpeditionEvent.create({
    data: {
      expeditionId: exp.id,
      userId: params.auth.sub,
      type: "SCAN",
      orderItemId: line.orderItemId,
      productId: line.productId,
      barcode: raw,
      qtyDelta: 1,
    },
  });

  return getExpeditionOrder(params.auth, params.orderId);
}

export async function adjustExpeditionItem(params: {
  auth: AccessPayload;
  orderId: string;
  orderItemId: string;
  delta: 1 | -1;
  reason: string;
}) {
  const reason = params.reason.trim();
  if (reason.length < 3) {
    throw new ExpeditionError(
      "Informe o motivo do ajuste manual (mínimo 3 caracteres).",
      "REASON_REQUIRED",
    );
  }
  const exp = await loadOpenExpedition(params.auth, params.orderId);
  const line = exp.items.find((i) => i.orderItemId === params.orderItemId);
  if (!line) {
    throw new ExpeditionError(
      "Item não encontrado neste pedido.",
      "NOT_FOUND",
      404,
    );
  }

  if (params.delta === 1) {
    const updated = await prisma.orderExpeditionItem.updateMany({
      where: { id: line.id, checkedQty: { lt: line.requestedQty } },
      data: { checkedQty: { increment: 1 } },
    });
    if (updated.count === 0) {
      throw new ExpeditionError(
        "Quantidade já conferida. Este produto não possui mais unidades pendentes.",
        "OVER_QTY",
      );
    }
  } else {
    const updated = await prisma.orderExpeditionItem.updateMany({
      where: { id: line.id, checkedQty: { gt: 0 } },
      data: { checkedQty: { decrement: 1 } },
    });
    if (updated.count === 0) {
      throw new ExpeditionError(
        "Quantidade conferida já está em zero.",
        "UNDER_QTY",
      );
    }
  }

  await prisma.orderExpeditionEvent.create({
    data: {
      expeditionId: exp.id,
      userId: params.auth.sub,
      type: params.delta === 1 ? "MANUAL_INC" : "MANUAL_DEC",
      orderItemId: line.orderItemId,
      productId: line.productId,
      qtyDelta: params.delta,
      reason,
    },
  });

  return getExpeditionOrder(params.auth, params.orderId);
}

export async function completeExpedition(auth: AccessPayload, orderId: string) {
  const packedId = await findOrgSituationId(
    auth.organizationId,
    EXPEDITION_SITUATION_CODES.PACKED,
  );
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, ...orderScopeWhere(auth) },
      include: { expedition: { include: { items: true } } },
    });
    if (!order?.expedition) {
      throw new ExpeditionError(
        "Inicie a separação antes de finalizar.",
        "NOT_STARTED",
        409,
      );
    }
    await tx.$executeRaw`SELECT id FROM "OrderExpedition" WHERE id = ${order.expedition.id} FOR UPDATE`;
    const exp = await tx.orderExpedition.findUniqueOrThrow({
      where: { id: order.expedition.id },
      include: { items: true },
    });
    if (exp.status === "COMPLETED") {
      return { already: true as const };
    }
    const pending = exp.items.filter((i) => i.checkedQty < i.requestedQty);
    if (pending.length > 0) {
      throw new ExpeditionError(
        "Ainda há produtos pendentes. Não é possível finalizar.",
        "INCOMPLETE",
      );
    }
    const now = new Date();
    await tx.orderExpedition.update({
      where: { id: exp.id },
      data: {
        status: "COMPLETED",
        finishedAt: now,
        finishedByUserId: auth.sub,
      },
    });
    await tx.orderExpeditionEvent.create({
      data: {
        expeditionId: exp.id,
        userId: auth.sub,
        type: "COMPLETE",
      },
    });
    await setOrderSituationId(tx, orderId, packedId);
    return { already: false as const };
  });

  if (!result.already) {
    await auditFromAuth(auth, {
      action: AUDIT_ACTION.EXPEDITION_COMPLETE,
      entityType: AUDIT_ENTITY.Order,
      entityId: orderId,
    });
  }
  return getExpeditionOrder(auth, orderId);
}

export async function setExpeditionVolumes(params: {
  auth: AccessPayload;
  orderId: string;
  volumeQty: number;
}) {
  if (
    !Number.isInteger(params.volumeQty) ||
    params.volumeQty < 1 ||
    params.volumeQty > 99
  ) {
    throw new ExpeditionError("Informe de 1 a 99 volumes.", "INVALID_VOLUMES");
  }
  const exp = await loadOpenExpedition(params.auth, params.orderId).catch(
    async (e) => {
      if (e instanceof ExpeditionError && e.code === "LOCKED") {
        const order = await prisma.order.findFirst({
          where: { id: params.orderId, ...orderScopeWhere(params.auth) },
          include: { expedition: true },
        });
        if (order?.expedition) return order.expedition;
      }
      throw e;
    },
  );
  await prisma.orderExpedition.update({
    where: { id: exp.id },
    data: { volumeQty: params.volumeQty },
  });
  return getExpeditionOrder(params.auth, params.orderId);
}

export async function markExpeditionShipped(
  auth: AccessPayload,
  orderId: string,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderScopeWhere(auth) },
    include: { expedition: true },
  });
  if (!order) {
    throw new ExpeditionError("Pedido não encontrado", "NOT_FOUND", 404);
  }
  if (order.expedition?.status !== "COMPLETED") {
    throw new ExpeditionError(
      "Finalize a separação antes de marcar como expedido.",
      "NOT_PACKED",
      409,
    );
  }
  const sentId = await findOrgSituationId(
    auth.organizationId,
    EXPEDITION_SITUATION_CODES.SHIPPED,
  );
  await setOrderSituationId(prisma, orderId, sentId);
  return getExpeditionOrder(auth, orderId);
}

export async function recordLabelPrint(params: {
  auth: AccessPayload;
  orderId: string;
  volumeIndex: number;
}) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, ...orderScopeWhere(params.auth) },
    include: { expedition: true },
  });
  if (!order?.expedition) {
    throw new ExpeditionError(
      "Inicie a separação antes de gerar etiqueta.",
      "NOT_STARTED",
      409,
    );
  }
  await prisma.orderExpeditionEvent.create({
    data: {
      expeditionId: order.expedition.id,
      userId: params.auth.sub,
      type: "LABEL_PRINT",
      reason: `volume ${params.volumeIndex}/${order.expedition.volumeQty}`,
    },
  });
  return order.expedition;
}
