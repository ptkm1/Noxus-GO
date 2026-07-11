import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/org-roles.js";
import { prisma } from "../db.js";
import { applyStockMovement } from "../services/stock.js";

const idParam = z.object({ id: z.string().min(1) });

export const stockRoutes: FastifyPluginAsync = async (app) => {
  app.get("/settings", async (req) => {
    const auth = req.auth!;
    const config = await prisma.organizationFiscalConfig.findUnique({
      where: { organizationId: auth.organizationId },
      select: { autoStockOnInboundInvoice: true },
    });
    return {
      autoStockOnInboundInvoice: config?.autoStockOnInboundInvoice ?? false,
    };
  });

  app.put("/settings", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const body = z
      .object({ autoStockOnInboundInvoice: z.boolean() })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });
    await prisma.organizationFiscalConfig.upsert({
      where: { organizationId: auth.organizationId },
      create: {
        organizationId: auth.organizationId,
        autoStockOnInboundInvoice: body.data.autoStockOnInboundInvoice,
      },
      update: { autoStockOnInboundInvoice: body.data.autoStockOnInboundInvoice },
    });
    return body.data;
  });

  app.get("/options", async (req) => {
    const auth = req.auth!;
    const q = z.object({ search: z.string().optional() }).safeParse(req.query);
    const products = await prisma.product.findMany({
      where: {
        organizationId: auth.organizationId,
        name: q.success && q.data.search
          ? { contains: q.data.search, mode: "insensitive" }
          : undefined,
      },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, sku: true },
    });
    return products;
  });

  app.get("/", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({
        search: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(100).optional(),
      })
      .safeParse(req.query);
    const page = q.success ? (q.data.page ?? 1) : 1;
    const pageSize = q.success ? (q.data.pageSize ?? 20) : 20;
    const where = {
      organizationId: auth.organizationId,
      name: q.success && q.data.search
        ? { contains: q.data.search, mode: "insensitive" }
        : undefined,
    };
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { productStock: true, category: { select: { name: true } } },
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name ?? null,
        quantityOnHand: p.productStock ? Number(p.productStock.quantityOnHand) : 0,
      })),
      page,
      pageSize,
      total,
      totalPages,
    };
  });

  app.get("/movements", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({
        productId: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(50).optional(),
      })
      .safeParse(req.query);
    const page = q.success ? (q.data.page ?? 1) : 1;
    const pageSize = q.success ? (q.data.pageSize ?? 15) : 15;
    const where = {
      organizationId: auth.organizationId,
      productId: q.success ? q.data.productId : undefined,
    };
    const [total, movements] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { product: { select: { id: true, name: true, sku: true } } },
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items: movements, page, pageSize, total, totalPages };
  });

  app.post("/movements", async (req, reply) => {
    const auth = req.auth!;
    if (!requireAdmin(reply, auth)) return;
    const body = z
      .object({
        productId: z.string().min(1),
        type: z.enum(["MANUAL_IN", "MANUAL_OUT", "MANUAL_ADJUST"]),
        quantity: z.number().positive(),
        notes: z.string().max(500).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "Dados inválidos" });

    const product = await prisma.product.findFirst({
      where: { id: body.data.productId, organizationId: auth.organizationId },
    });
    if (!product) return reply.status(404).send({ error: "Produto não encontrado" });

    try {
      const movement = await applyStockMovement({
        organizationId: auth.organizationId,
        productId: body.data.productId,
        type: body.data.type,
        quantity: body.data.quantity,
        notes: body.data.notes,
        createdByUserId: auth.sub,
      });
      return prisma.stockMovement.findUniqueOrThrow({
        where: { id: movement.id },
        include: { product: { select: { id: true, name: true, sku: true } } },
      });
    } catch (e) {
      return reply.status(400).send({
        error: e instanceof Error ? e.message : "Erro ao movimentar estoque",
      });
    }
  });
};
