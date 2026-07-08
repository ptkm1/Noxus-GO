import {
  Prisma,
  type OrderStatus,
  type PromotionKind,
  type PromotionScope,
} from "@prisma/client";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { verifyAccessToken } from "../auth/jwt.js";
import {
  isManagerGetAllowed,
  isOrgStaff,
  isTeamLeaderAuth,
  isTeamLeaderGetAllowed,
  orderScopeWhere,
  requireAdmin,
  requireOrgStaff,
  sellerScopeWhere,
  teamMemberSellerIds,
  validateManagerAssignment,
} from "../auth/org-roles.js";
import { hashPassword } from "../auth/password.js";
import { prisma } from "../db.js";
import {
  customerBodySchema,
  customerPatchSchema,
  toCustomerPrismaData,
  type CustomerBodyInput,
} from "../services/customer-validation.js";
import { buildDistributorInsights } from "../services/distributor-insights.js";
import { sendOrderPdfReply } from "../services/order-pdf-load.js";
import {
  computeSaleOrder,
  OrderPricingError,
} from "../services/order-pricing.js";
import type { AttributeFieldDef } from "../services/product-attributes.js";
import {
  parseCategoryAttributeSchema,
  validateProductAttributes,
} from "../services/product-attributes.js";
import {
  applyStockOnStatusChange,
  assertSufficientStock,
  StockError,
} from "../services/product-stock.js";
import { buildSalesBySupplier } from "../services/sales-by-supplier.js";
import {
  createSalesTeam,
  deleteSalesTeam,
  getSalesTeam,
  listSalesTeams,
  SalesTeamError,
  serializeSalesTeam,
  updateSalesTeam,
} from "../services/sales-teams.js";
import { getSellerLocationHistory } from "../services/seller-location-history.js";
import { registerSellerLocationClient } from "../services/seller-location-ws.js";
import { listAdminSellerLocations } from "../services/seller-locations-admin.js";
import {
  assertSupplierInOrg,
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  SupplierError,
  updateSupplier,
} from "../services/suppliers.js";
import { buildTeamSalesSummary } from "../services/team-sales-summary.js";
import { decToNum } from "../util/money.js";

const idParam = z.object({ id: z.string().min(1) });

const sellerCommissionTypeSchema = z.enum([
  "FIXED",
  "BY_PRODUCT",
  "BY_CATEGORY",
  "BY_SUPPLIER",
]);

const optionalCommissionPercentSchema = z
  .number()
  .min(0)
  .max(100)
  .nullable()
  .optional();

/** Aceita `YYYY-MM-DD` (UTC) ou ISO completo; `start` = início do dia, `end` = fim do dia. */
function parseVisitPeriodDate(
  raw: string | undefined,
  kind: "start" | "end",
): Date | null {
  const s = raw?.trim();
  if (!s) return null;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (day) {
    const y = Number(day[1]);
    const mo = Number(day[2]);
    const d = Number(day[3]);
    if (kind === "start") return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
    return new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Identificador estável por organização (equivalente a um valor de enum). */
function normalizeCategoryCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function normalizeRegionCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function normalizeProductBarcode(
  raw: string | undefined | null,
): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function loadCategoryDefs(
  categoryId: string | null,
  organizationId: string,
): Promise<AttributeFieldDef[]> {
  if (!categoryId) return [];
  const cat = await prisma.productCategory.findFirst({
    where: { id: categoryId, organizationId },
    select: { attributeSchema: true },
  });
  if (!cat?.attributeSchema) return [];
  const p = parseCategoryAttributeSchema(cat.attributeSchema);
  return p.ok ? p.defs : [];
}

const promotionRelationInclude = {
  seller: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  customer: { select: { id: true, name: true, email: true } },
} as const;

type PromotionRow = Prisma.ProductPromotionGetPayload<{
  include: typeof promotionRelationInclude;
}>;

function serializeProductPromotion(row: PromotionRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    productId: row.productId,
    scope: row.scope,
    sellerId: row.sellerId,
    customerId: row.customerId,
    kind: row.kind,
    value: decToNum(row.value),
    label: row.label,
    active: row.active,
    validFrom: row.validFrom?.toISOString() ?? null,
    validTo: row.validTo?.toISOString() ?? null,
    priority: row.priority,
    minQuantity: row.minQuantity,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    seller: row.seller
      ? {
          id: row.seller.id,
          name: row.seller.user.name,
          email: row.seller.user.email,
        }
      : null,
    customer: row.customer
      ? {
          id: row.customer.id,
          name: row.customer.name,
          email: row.customer.email ?? null,
        }
      : null,
  };
}

function assertPromotionCoherence(p: {
  scope: PromotionScope;
  sellerId: string | null | undefined;
  customerId: string | null | undefined;
  kind: PromotionKind;
  value: number;
}): string | null {
  const sellerId = p.sellerId ?? null;
  const customerId = p.customerId ?? null;
  if (p.scope === "PRODUCT_GLOBAL" && (sellerId || customerId)) {
    return "Promoção para todos não deve ter vendedor nem cliente.";
  }
  if (p.scope === "SELLER") {
    if (!sellerId) return "Escolha o vendedor.";
    if (customerId) return "Promoção por vendedor não deve ter cliente.";
  }
  if (p.scope === "CUSTOMER") {
    if (!customerId) return "Escolha o cliente.";
    if (sellerId) return "Promoção por cliente não deve ter vendedor.";
  }
  if (p.kind === "PERCENT_OFF" && (p.value < 0 || p.value > 100)) {
    return "Percentual deve estar entre 0 e 100.";
  }
  if (
    (p.kind === "FIXED_AMOUNT_OFF" || p.kind === "SALE_PRICE") &&
    p.value < 0
  ) {
    return "Valor deve ser maior ou igual a zero.";
  }
  return null;
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook(
    "preHandler",
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!requireOrgStaff(reply, req.auth)) return;

      const auth = req.auth!;
      const method = req.method.toUpperCase();
      const routePath =
        req.routeOptions?.url ?? req.url.split("?")[0] ?? req.url;

      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        if (!requireAdmin(reply, auth)) return;
        return;
      }

      if (routePath === "/seller-locations/ws") return;

      if (
        auth.role === "MANAGER" &&
        method === "GET" &&
        !isManagerGetAllowed(routePath)
      ) {
        return reply
          .status(403)
          .send({ error: "Gestores não têm acesso a este recurso" });
      }

      if (
        isTeamLeaderAuth(auth) &&
        method === "GET" &&
        !isTeamLeaderGetAllowed(routePath)
      ) {
        return reply
          .status(403)
          .send({ error: "Líderes de equipe não têm acesso a este recurso" });
      }
    },
  );

  /** Raiz do prefixo `/api/v1/admin` — útil para testar URL base (sem isto, GET aqui dava 404). */
  app.get("/", async () => ({ ok: true, scope: "admin" as const }));

  app.get("/pricing-settings", async (req) => {
    const auth = req.auth!;
    const org = await prisma.organization.findUnique({
      where: { id: auth.organizationId },
      select: { defaultMaxSellerDiscountPercent: true, creditPolicy: true },
    });
    if (!org)
      return {
        defaultMaxSellerDiscountPercent: 50,
        creditPolicy: "WARN_ONLY" as const,
      };
    return {
      defaultMaxSellerDiscountPercent: decToNum(
        org.defaultMaxSellerDiscountPercent,
      ),
      creditPolicy: org.creditPolicy,
    };
  });

  app.patch("/pricing-settings", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        defaultMaxSellerDiscountPercent: z.number().min(0).max(100).optional(),
        creditPolicy: z
          .enum(["WARN_ONLY", "BLOCK_ORDER", "REQUIRE_APPROVAL"])
          .optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const data: Prisma.OrganizationUpdateInput = {};
    if (body.data.defaultMaxSellerDiscountPercent !== undefined) {
      data.defaultMaxSellerDiscountPercent =
        body.data.defaultMaxSellerDiscountPercent;
    }
    if (body.data.creditPolicy !== undefined) {
      data.creditPolicy = body.data.creditPolicy;
    }
    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: "Nada para atualizar" });
    }

    await prisma.organization.update({
      where: { id: auth.organizationId },
      data,
    });
    return { ok: true };
  });

  /**
   * Marca / whitelabel da própria organização (`organizationId` do token).
   * UI web: quando existir tela de configurações gerais, pode consumir este PATCH (campos todos opcionais).
   */
  app.patch("/organization/branding", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        displayName: z.string().trim().min(1).max(160).optional(),
        logoUrl: z
          .union([z.string().url(), z.literal(""), z.null()])
          .optional(),
        primaryColor: z
          .union([
            z.string().regex(/^#([0-9A-Fa-f]{6})$/),
            z.literal(""),
            z.null(),
          ])
          .optional(),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(64)
          .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
          .optional()
          .nullable(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const data: Prisma.OrganizationUpdateInput = {};
    if (body.data.displayName !== undefined) {
      data.displayName = body.data.displayName;
    }
    if (body.data.logoUrl !== undefined) {
      data.logoUrl = body.data.logoUrl === "" ? null : body.data.logoUrl;
    }
    if (body.data.primaryColor !== undefined) {
      data.primaryColor =
        body.data.primaryColor === "" ? null : body.data.primaryColor;
    }
    if (body.data.slug !== undefined) {
      data.slug = body.data.slug;
    }
    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: "Nada para atualizar" });
    }

    try {
      await prisma.organization.update({
        where: { id: auth.organizationId },
        data,
      });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code?: string }).code === "P2002"
      ) {
        return reply
          .status(409)
          .send({ error: "Slug já em uso por outra organização" });
      }
      throw e;
    }
    return { ok: true };
  });

  /* --- Regiões (preço por região via cliente + tabela) --- */
  app.get("/regions", async (req) => {
    const auth = req.auth!;
    return prisma.region.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: [{ name: "asc" }],
    });
  });

  app.post("/regions", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({ code: z.string().min(1), name: z.string().min(1) })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });
    const code = normalizeRegionCode(body.data.code);
    if (!code.length)
      return reply.status(400).send({ error: "Código de região inválido" });
    try {
      return await prisma.region.create({
        data: {
          organizationId: auth.organizationId,
          code,
          name: body.data.name.trim(),
        },
      });
    } catch {
      return reply
        .status(409)
        .send({ error: "Já existe região com esse código" });
    }
  });

  app.patch("/regions/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        code: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });
    const existing = await prisma.region.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    const code =
      body.data.code !== undefined
        ? normalizeRegionCode(body.data.code)
        : undefined;
    if (code !== undefined && !code.length) {
      return reply.status(400).send({ error: "Código de região inválido" });
    }
    try {
      return await prisma.region.update({
        where: { id },
        data: {
          code: code ?? undefined,
          name: body.data.name?.trim(),
        },
      });
    } catch {
      return reply
        .status(409)
        .send({ error: "Já existe região com esse código" });
    }
  });

  app.delete("/regions/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const existing = await prisma.region.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    await prisma.region.delete({ where: { id } });
    return reply.status(204).send();
  });

  /* --- Tabelas de preço --- */
  app.get("/price-tables", async (req) => {
    const auth = req.auth!;
    return prisma.priceTable.findMany({
      where: { organizationId: auth.organizationId },
      include: {
        items: { include: { product: true } },
        customer: { select: { id: true, name: true } },
        seller: { include: { user: { select: { name: true } } } },
        region: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/price-tables", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        name: z.string().min(1),
        validFrom: z.string().datetime().optional(),
        validTo: z.string().datetime().optional(),
        priority: z.number().int().optional(),
        customerId: z.string().nullable().optional(),
        sellerId: z.string().nullable().optional(),
        regionId: z.string().nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const d = body.data;
    if (d.customerId) {
      const c = await prisma.customer.findFirst({
        where: { id: d.customerId, organizationId: auth.organizationId },
      });
      if (!c)
        return reply
          .status(400)
          .send({ error: "Cliente inválido para escopo da tabela" });
    }
    if (d.sellerId) {
      const s = await prisma.seller.findFirst({
        where: { id: d.sellerId, organizationId: auth.organizationId },
      });
      if (!s)
        return reply
          .status(400)
          .send({ error: "Vendedor inválido para escopo da tabela" });
    }
    if (d.regionId) {
      const r = await prisma.region.findFirst({
        where: { id: d.regionId, organizationId: auth.organizationId },
      });
      if (!r)
        return reply
          .status(400)
          .send({ error: "Região inválida para escopo da tabela" });
    }

    return prisma.priceTable.create({
      data: {
        name: d.name,
        organizationId: auth.organizationId,
        validFrom: d.validFrom ? new Date(d.validFrom) : null,
        validTo: d.validTo ? new Date(d.validTo) : null,
        priority: d.priority ?? 0,
        customerId: d.customerId ?? null,
        sellerId: d.sellerId ?? null,
        regionId: d.regionId ?? null,
      },
    });
  });

  app.patch("/price-tables/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        validFrom: z.string().datetime().nullable().optional(),
        validTo: z.string().datetime().nullable().optional(),
        priority: z.number().int().optional(),
        customerId: z.string().nullable().optional(),
        sellerId: z.string().nullable().optional(),
        regionId: z.string().nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const existing = await prisma.priceTable.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    const d = body.data;
    if (d.customerId) {
      const c = await prisma.customer.findFirst({
        where: { id: d.customerId, organizationId: auth.organizationId },
      });
      if (!c)
        return reply
          .status(400)
          .send({ error: "Cliente inválido para escopo da tabela" });
    }
    if (d.sellerId) {
      const s = await prisma.seller.findFirst({
        where: { id: d.sellerId, organizationId: auth.organizationId },
      });
      if (!s)
        return reply
          .status(400)
          .send({ error: "Vendedor inválido para escopo da tabela" });
    }
    if (d.regionId) {
      const r = await prisma.region.findFirst({
        where: { id: d.regionId, organizationId: auth.organizationId },
      });
      if (!r)
        return reply
          .status(400)
          .send({ error: "Região inválida para escopo da tabela" });
    }

    return prisma.priceTable.update({
      where: { id },
      data: {
        name: d.name ?? undefined,
        validFrom:
          d.validFrom === undefined
            ? undefined
            : d.validFrom
              ? new Date(d.validFrom)
              : null,
        validTo:
          d.validTo === undefined
            ? undefined
            : d.validTo
              ? new Date(d.validTo)
              : null,
        priority: d.priority ?? undefined,
        customerId: d.customerId === undefined ? undefined : d.customerId,
        sellerId: d.sellerId === undefined ? undefined : d.sellerId,
        regionId: d.regionId === undefined ? undefined : d.regionId,
      },
    });
  });

  app.delete("/price-tables/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const existing = await prisma.priceTable.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    await prisma.priceTable.delete({ where: { id } });
    return reply.status(204).send();
  });

  app.post("/price-tables/:id/items", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        productId: z.string(),
        price: z.number().positive(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const pt = await prisma.priceTable.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!pt) return reply.status(404).send({ error: "Tabela não encontrada" });
    const prod = await prisma.product.findFirst({
      where: { id: body.data.productId, organizationId: auth.organizationId },
    });
    if (!prod) return reply.status(400).send({ error: "Produto inválido" });

    return prisma.priceTableItem.upsert({
      where: {
        priceTableId_productId: {
          priceTableId: id,
          productId: body.data.productId,
        },
      },
      create: {
        priceTableId: id,
        productId: body.data.productId,
        price: body.data.price,
      },
      update: { price: body.data.price },
    });
  });

  app.delete("/price-tables/:tableId/items/:productId", async (req, reply) => {
    const auth = req.auth!;
    const p = z
      .object({ tableId: z.string(), productId: z.string() })
      .parse(req.params);
    const pt = await prisma.priceTable.findFirst({
      where: { id: p.tableId, organizationId: auth.organizationId },
    });
    if (!pt) return reply.status(404).send({ error: "Tabela não encontrada" });
    await prisma.priceTableItem.deleteMany({
      where: { priceTableId: p.tableId, productId: p.productId },
    });
    return reply.status(204).send();
  });

  /* --- Categorias de produto (lookup / “enum” por organização) --- */
  app.get("/product-categories", async (req) => {
    const auth = req.auth!;
    return prisma.productCategory.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: [{ code: "asc" }],
    });
  });

  app.post("/product-categories", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        code: z.string().min(1),
        name: z.string().min(1),
        attributeSchema: z.any().optional(),
        commissionPercent: optionalCommissionPercentSchema,
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const code = normalizeCategoryCode(body.data.code);
    if (!code.length)
      return reply
        .status(400)
        .send({ error: "Código inválido (use letras, números e _)" });

    let schemaValue: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
    if (body.data.attributeSchema !== undefined) {
      const parsed = parseCategoryAttributeSchema(body.data.attributeSchema);
      if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
      schemaValue =
        parsed.defs.length > 0
          ? (parsed.defs as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull;
    }

    try {
      return await prisma.productCategory.create({
        data: {
          organizationId: auth.organizationId,
          code,
          name: body.data.name.trim(),
          ...(body.data.commissionPercent !== undefined
            ? { commissionPercent: body.data.commissionPercent }
            : {}),
          ...(schemaValue !== undefined
            ? { attributeSchema: schemaValue }
            : {}),
        },
      });
    } catch {
      return reply
        .status(409)
        .send({ error: "Já existe categoria com esse código" });
    }
  });

  app.patch("/product-categories/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        code: z.string().min(1).optional(),
        attributeSchema: z.any().nullable().optional(),
        commissionPercent: optionalCommissionPercentSchema,
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const existing = await prisma.productCategory.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    if (
      body.data.name === undefined &&
      body.data.code === undefined &&
      body.data.attributeSchema === undefined &&
      body.data.commissionPercent === undefined
    ) {
      return reply.status(400).send({
        error:
          "Informe nome, código, comissão ou campos dinâmicos para atualizar",
      });
    }

    const code =
      body.data.code !== undefined
        ? normalizeCategoryCode(body.data.code)
        : undefined;
    if (code !== undefined && !code.length) {
      return reply
        .status(400)
        .send({ error: "Código inválido (use letras, números e _)" });
    }

    let schemaPatch: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
    if (body.data.attributeSchema !== undefined) {
      if (body.data.attributeSchema === null) {
        schemaPatch = Prisma.JsonNull;
      } else {
        const parsed = parseCategoryAttributeSchema(body.data.attributeSchema);
        if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
        schemaPatch =
          parsed.defs.length > 0
            ? (parsed.defs as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull;
      }
    }

    try {
      return await prisma.productCategory.update({
        where: { id },
        data: {
          name: body.data.name?.trim(),
          ...(code !== undefined ? { code } : {}),
          ...(body.data.commissionPercent !== undefined
            ? { commissionPercent: body.data.commissionPercent }
            : {}),
          ...(schemaPatch !== undefined
            ? { attributeSchema: schemaPatch }
            : {}),
        },
      });
    } catch {
      return reply
        .status(409)
        .send({ error: "Já existe categoria com esse código" });
    }
  });

  app.delete("/product-categories/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const existing = await prisma.productCategory.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    await prisma.productCategory.delete({ where: { id } });
    return reply.status(204).send();
  });

  /* --- Produtos --- */
  const productRelationsInclude = {
    category: {
      select: { id: true, code: true, name: true, attributeSchema: true },
    },
    supplier: {
      select: {
        id: true,
        code: true,
        tradeName: true,
        legalName: true,
        cnpj: true,
      },
    },
  } as const;

  /* --- Fornecedores --- */
  app.get("/suppliers", async (req) => {
    const auth = req.auth!;
    return listSuppliers(auth.organizationId);
  });

  app.get("/suppliers/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const supplier = await getSupplier(auth.organizationId, id);
    if (!supplier)
      return reply.status(404).send({ error: "Fornecedor não encontrado" });
    return supplier;
  });

  app.post("/suppliers", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        code: z.string().min(1),
        legalName: z.string().min(1),
        cnpj: z.string().min(1),
        tradeName: z.string().min(1),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    try {
      return await createSupplier(auth.organizationId, body.data);
    } catch (e) {
      if (e instanceof SupplierError)
        return reply.status(400).send({ error: e.message });
      throw e;
    }
  });

  app.patch("/suppliers/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        code: z.string().min(1).optional(),
        legalName: z.string().min(1).optional(),
        cnpj: z.string().min(1).optional(),
        tradeName: z.string().min(1).optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    try {
      const supplier = await updateSupplier(auth.organizationId, id, body.data);
      if (!supplier)
        return reply.status(404).send({ error: "Fornecedor não encontrado" });
      return supplier;
    } catch (e) {
      if (e instanceof SupplierError)
        return reply.status(400).send({ error: e.message });
      throw e;
    }
  });

  app.delete("/suppliers/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    try {
      const ok = await deleteSupplier(auth.organizationId, id);
      if (!ok)
        return reply.status(404).send({ error: "Fornecedor não encontrado" });
      return reply.status(204).send();
    } catch (e) {
      if (e instanceof SupplierError)
        return reply.status(400).send({ error: e.message });
      throw e;
    }
  });

  app.get("/products", async (req) => {
    const auth = req.auth!;
    return prisma.product.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { name: "asc" },
      include: productRelationsInclude,
    });
  });

  app.get("/products/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const p = await prisma.product.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: productRelationsInclude,
    });
    if (!p) return reply.status(404).send({ error: "Não encontrado" });
    return p;
  });

  app.post("/products", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        name: z.string().min(1),
        sku: z.string().optional(),
        barcode: z.string().max(80).optional(),
        description: z.string().optional(),
        imageUrl: z.union([z.string().max(2048), z.literal("")]).optional(),
        basePrice: z.number().nonnegative(),
        categoryId: z.string().min(1),
        supplierId: z.string().min(1),
        attributes: z.record(z.string(), z.unknown()).optional(),
        maxSellerDiscountPercent: z
          .number()
          .min(0)
          .max(100)
          .nullable()
          .optional(),
        minSaleUnitPrice: z.number().nonnegative().nullable().optional(),
        commissionPercent: optionalCommissionPercentSchema,
        stockQty: z.number().int().min(0).optional(),
        blockSaleWhenOutOfStock: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const resolvedCatId = body.data.categoryId;

    const categoryOk = await prisma.productCategory.findFirst({
      where: { id: resolvedCatId, organizationId: auth.organizationId },
    });
    if (!categoryOk)
      return reply.status(400).send({ error: "Grupo de produtos inválido" });

    const supplierOk = await assertSupplierInOrg(
      auth.organizationId,
      body.data.supplierId,
    );
    if (!supplierOk)
      return reply.status(400).send({ error: "Fornecedor inválido" });

    const defs = await loadCategoryDefs(resolvedCatId, auth.organizationId);
    const attrsRaw = body.data.attributes ?? {};
    const validated = validateProductAttributes(attrsRaw, defs);
    if (!validated.ok)
      return reply.status(400).send({ error: validated.error });

    try {
      return await prisma.product.create({
        data: {
          name: body.data.name,
          sku: body.data.sku,
          barcode: normalizeProductBarcode(body.data.barcode) ?? undefined,
          description: body.data.description,
          imageUrl:
            body.data.imageUrl === undefined || body.data.imageUrl === ""
              ? undefined
              : body.data.imageUrl.trim() || undefined,
          basePrice: body.data.basePrice,
          organizationId: auth.organizationId,
          categoryId: body.data.categoryId,
          supplierId: body.data.supplierId,
          attributes: validated.value as Prisma.InputJsonValue,
          maxSellerDiscountPercent:
            body.data.maxSellerDiscountPercent === undefined
              ? undefined
              : body.data.maxSellerDiscountPercent,
          minSaleUnitPrice:
            body.data.minSaleUnitPrice === undefined
              ? undefined
              : body.data.minSaleUnitPrice,
          commissionPercent:
            body.data.commissionPercent === undefined
              ? undefined
              : body.data.commissionPercent,
          stockQty: body.data.stockQty ?? 0,
          blockSaleWhenOutOfStock: body.data.blockSaleWhenOutOfStock ?? false,
        },
        include: productRelationsInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return reply
          .status(400)
          .send({ error: "Código de barras já cadastrado nesta empresa." });
      }
      throw e;
    }
  });

  app.patch("/products/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        sku: z.string().nullable().optional(),
        barcode: z.string().max(80).nullable().optional(),
        description: z.string().nullable().optional(),
        imageUrl: z
          .union([z.string().max(2048), z.literal("")])
          .nullable()
          .optional(),
        basePrice: z.number().nonnegative().optional(),
        categoryId: z.string().nullable().optional(),
        supplierId: z.string().nullable().optional(),
        attributes: z.record(z.string(), z.unknown()).optional(),
        maxSellerDiscountPercent: z
          .number()
          .min(0)
          .max(100)
          .nullable()
          .optional(),
        minSaleUnitPrice: z.number().nonnegative().nullable().optional(),
        commissionPercent: optionalCommissionPercentSchema,
        stockQty: z.number().int().min(0).optional(),
        blockSaleWhenOutOfStock: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const existing = await prisma.product.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    if (body.data.categoryId === null) {
      return reply
        .status(400)
        .send({ error: "Grupo de produtos é obrigatório" });
    }
    if (body.data.supplierId === null) {
      return reply.status(400).send({ error: "Fornecedor é obrigatório" });
    }

    if (body.data.categoryId !== undefined && body.data.categoryId !== null) {
      const ok = await prisma.productCategory.findFirst({
        where: {
          id: body.data.categoryId,
          organizationId: auth.organizationId,
        },
      });
      if (!ok)
        return reply.status(400).send({ error: "Grupo de produtos inválido" });
    }

    if (body.data.supplierId !== undefined && body.data.supplierId !== null) {
      const ok = await assertSupplierInOrg(
        auth.organizationId,
        body.data.supplierId,
      );
      if (!ok) return reply.status(400).send({ error: "Fornecedor inválido" });
    }

    const resolvedCatId =
      body.data.categoryId !== undefined
        ? body.data.categoryId
        : existing.categoryId;

    const categoryChanged =
      body.data.categoryId !== undefined &&
      body.data.categoryId !== existing.categoryId;
    const attrsProvided = body.data.attributes !== undefined;

    let validatedAttrs: Record<string, unknown> | undefined;

    if (attrsProvided || categoryChanged) {
      const mergedAttrs = attrsProvided
        ? body.data.attributes!
        : (existing.attributes as Record<string, unknown>);
      const defs = await loadCategoryDefs(
        resolvedCatId ?? null,
        auth.organizationId,
      );
      const validated = validateProductAttributes(mergedAttrs, defs);
      if (!validated.ok)
        return reply.status(400).send({ error: validated.error });
      validatedAttrs = validated.value;
    }

    try {
      return await prisma.product.update({
        where: { id },
        data: {
          name: body.data.name,
          sku: body.data.sku === undefined ? undefined : body.data.sku,
          barcode:
            body.data.barcode === undefined
              ? undefined
              : normalizeProductBarcode(body.data.barcode),
          description:
            body.data.description === undefined
              ? undefined
              : body.data.description,
          basePrice: body.data.basePrice,
          ...(body.data.imageUrl !== undefined
            ? {
                imageUrl:
                  body.data.imageUrl === null || body.data.imageUrl === ""
                    ? null
                    : body.data.imageUrl.trim() || null,
              }
            : {}),
          categoryId:
            body.data.categoryId === undefined
              ? undefined
              : body.data.categoryId,
          supplierId:
            body.data.supplierId === undefined
              ? undefined
              : body.data.supplierId,
          ...(validatedAttrs !== undefined
            ? { attributes: validatedAttrs as Prisma.InputJsonValue }
            : {}),
          maxSellerDiscountPercent:
            body.data.maxSellerDiscountPercent === undefined
              ? undefined
              : body.data.maxSellerDiscountPercent,
          minSaleUnitPrice:
            body.data.minSaleUnitPrice === undefined
              ? undefined
              : body.data.minSaleUnitPrice,
          commissionPercent:
            body.data.commissionPercent === undefined
              ? undefined
              : body.data.commissionPercent,
          stockQty: body.data.stockQty,
          blockSaleWhenOutOfStock: body.data.blockSaleWhenOutOfStock,
        },
        include: productRelationsInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return reply
          .status(400)
          .send({ error: "Código de barras já cadastrado nesta empresa." });
      }
      throw e;
    }
  });

  app.delete("/products/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const existing = await prisma.product.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    await prisma.product.delete({ where: { id } });
    return reply.status(204).send();
  });

  /* --- Promoções por produto --- */
  app.get("/products/:productId/promotions", async (req, reply) => {
    const auth = req.auth!;
    const { productId } = z
      .object({ productId: z.string().min(1) })
      .parse(req.params);
    const prod = await prisma.product.findFirst({
      where: { id: productId, organizationId: auth.organizationId },
    });
    if (!prod)
      return reply.status(404).send({ error: "Produto não encontrado" });

    const rows = await prisma.productPromotion.findMany({
      where: { productId, organizationId: auth.organizationId },
      include: promotionRelationInclude,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(serializeProductPromotion);
  });

  app.post("/products/:productId/promotions", async (req, reply) => {
    const auth = req.auth!;
    const { productId } = z
      .object({ productId: z.string().min(1) })
      .parse(req.params);
    const body = z
      .object({
        scope: z.enum(["PRODUCT_GLOBAL", "SELLER", "CUSTOMER"]),
        sellerId: z.string().optional(),
        customerId: z.string().optional(),
        kind: z.enum(["PERCENT_OFF", "FIXED_AMOUNT_OFF", "SALE_PRICE"]),
        value: z.number(),
        label: z.string().optional(),
        active: z.boolean().optional(),
        validFrom: z.string().datetime().nullable().optional(),
        validTo: z.string().datetime().nullable().optional(),
        priority: z.number().int().optional(),
        minQuantity: z.number().int().positive().nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const prod = await prisma.product.findFirst({
      where: { id: productId, organizationId: auth.organizationId },
    });
    if (!prod)
      return reply.status(404).send({ error: "Produto não encontrado" });

    const d = body.data;
    const sellerId = d.scope === "SELLER" ? (d.sellerId ?? null) : null;
    const customerId = d.scope === "CUSTOMER" ? (d.customerId ?? null) : null;

    const errMsg = assertPromotionCoherence({
      scope: d.scope,
      sellerId,
      customerId,
      kind: d.kind,
      value: d.value,
    });
    if (errMsg) return reply.status(400).send({ error: errMsg });

    if (d.scope === "SELLER") {
      const s = await prisma.seller.findFirst({
        where: { id: sellerId!, organizationId: auth.organizationId },
      });
      if (!s) return reply.status(400).send({ error: "Vendedor inválido" });
    }
    if (d.scope === "CUSTOMER") {
      const c = await prisma.customer.findFirst({
        where: { id: customerId!, organizationId: auth.organizationId },
      });
      if (!c) return reply.status(400).send({ error: "Cliente inválido" });
    }

    const row = await prisma.productPromotion.create({
      data: {
        organizationId: auth.organizationId,
        productId,
        scope: d.scope,
        sellerId,
        customerId,
        kind: d.kind,
        value: d.value,
        label: d.label ?? null,
        active: d.active ?? true,
        validFrom: d.validFrom ? new Date(d.validFrom) : null,
        validTo: d.validTo ? new Date(d.validTo) : null,
        priority: d.priority ?? 0,
        minQuantity: d.minQuantity ?? null,
      },
      include: promotionRelationInclude,
    });
    return serializeProductPromotion(row);
  });

  app.patch(
    "/products/:productId/promotions/:promotionId",
    async (req, reply) => {
      const auth = req.auth!;
      const p = z
        .object({
          productId: z.string().min(1),
          promotionId: z.string().min(1),
        })
        .parse(req.params);
      const body = z
        .object({
          scope: z.enum(["PRODUCT_GLOBAL", "SELLER", "CUSTOMER"]).optional(),
          sellerId: z.string().nullable().optional(),
          customerId: z.string().nullable().optional(),
          kind: z
            .enum(["PERCENT_OFF", "FIXED_AMOUNT_OFF", "SALE_PRICE"])
            .optional(),
          value: z.number().optional(),
          label: z.string().nullable().optional(),
          active: z.boolean().optional(),
          validFrom: z.string().datetime().nullable().optional(),
          validTo: z.string().datetime().nullable().optional(),
          priority: z.number().int().optional(),
          minQuantity: z.number().int().positive().nullable().optional(),
        })
        .safeParse(req.body);
      if (!body.success)
        return reply.status(400).send({ error: "Dados inválidos" });

      const existing = await prisma.productPromotion.findFirst({
        where: {
          id: p.promotionId,
          productId: p.productId,
          organizationId: auth.organizationId,
        },
      });
      if (!existing) return reply.status(404).send({ error: "Não encontrado" });

      const scope = body.data.scope ?? existing.scope;
      let sellerId =
        body.data.sellerId !== undefined
          ? body.data.sellerId
          : existing.sellerId;
      let customerId =
        body.data.customerId !== undefined
          ? body.data.customerId
          : existing.customerId;

      if (scope === "PRODUCT_GLOBAL") {
        sellerId = null;
        customerId = null;
      } else if (scope === "SELLER") {
        customerId = null;
      } else if (scope === "CUSTOMER") {
        sellerId = null;
      }

      const kind = body.data.kind ?? existing.kind;
      const value = body.data.value ?? decToNum(existing.value);

      const errMsg = assertPromotionCoherence({
        scope,
        sellerId,
        customerId,
        kind,
        value,
      });
      if (errMsg) return reply.status(400).send({ error: errMsg });

      if (scope === "SELLER") {
        const s = await prisma.seller.findFirst({
          where: { id: sellerId!, organizationId: auth.organizationId },
        });
        if (!s) return reply.status(400).send({ error: "Vendedor inválido" });
      }
      if (scope === "CUSTOMER") {
        const c = await prisma.customer.findFirst({
          where: { id: customerId!, organizationId: auth.organizationId },
        });
        if (!c) return reply.status(400).send({ error: "Cliente inválido" });
      }

      const row = await prisma.productPromotion.update({
        where: { id: p.promotionId },
        data: {
          scope,
          sellerId,
          customerId,
          kind,
          value: body.data.value ?? undefined,
          label: body.data.label === undefined ? undefined : body.data.label,
          active: body.data.active ?? undefined,
          validFrom:
            body.data.validFrom === undefined
              ? undefined
              : body.data.validFrom
                ? new Date(body.data.validFrom)
                : null,
          validTo:
            body.data.validTo === undefined
              ? undefined
              : body.data.validTo
                ? new Date(body.data.validTo)
                : null,
          priority: body.data.priority ?? undefined,
          minQuantity:
            body.data.minQuantity === undefined
              ? undefined
              : body.data.minQuantity === null
                ? null
                : body.data.minQuantity,
        },
        include: promotionRelationInclude,
      });
      return serializeProductPromotion(row);
    },
  );

  app.delete(
    "/products/:productId/promotions/:promotionId",
    async (req, reply) => {
      const auth = req.auth!;
      const par = z
        .object({
          productId: z.string().min(1),
          promotionId: z.string().min(1),
        })
        .parse(req.params);
      const existing = await prisma.productPromotion.findFirst({
        where: {
          id: par.promotionId,
          productId: par.productId,
          organizationId: auth.organizationId,
        },
      });
      if (!existing) return reply.status(404).send({ error: "Não encontrado" });
      await prisma.productPromotion.delete({ where: { id: par.promotionId } });
      return reply.status(204).send();
    },
  );

  /* --- Vendedores --- */
  app.get("/managers", async (req) => {
    const auth = req.auth!;
    return prisma.user.findMany({
      where: { organizationId: auth.organizationId, role: "MANAGER" },
      select: { id: true, email: true, name: true },
      orderBy: { name: "asc" },
    });
  });

  /* --- Equipes de vendas (admin) --- */
  app.get("/teams", async (req) => {
    const auth = req.auth!;
    const teams = await listSalesTeams(auth.organizationId);
    return teams.map(serializeSalesTeam);
  });

  app.get("/teams/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const team = await getSalesTeam(auth.organizationId, id);
    if (!team)
      return reply.status(404).send({ error: "Equipe não encontrada" });
    return serializeSalesTeam(team);
  });

  app.post("/teams", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        name: z.string().min(1),
        leaderSellerId: z.string().min(1),
        memberSellerIds: z.array(z.string().min(1)).min(1),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    try {
      const team = await createSalesTeam(auth.organizationId, body.data);
      return serializeSalesTeam(team);
    } catch (e) {
      if (e instanceof SalesTeamError)
        return reply.status(400).send({ error: e.message });
      throw e;
    }
  });

  app.patch("/teams/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        leaderSellerId: z.string().min(1).optional(),
        memberSellerIds: z.array(z.string().min(1)).min(1).optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    try {
      const team = await updateSalesTeam(auth.organizationId, id, body.data);
      if (!team)
        return reply.status(404).send({ error: "Equipe não encontrada" });
      return serializeSalesTeam(team);
    } catch (e) {
      if (e instanceof SalesTeamError)
        return reply.status(400).send({ error: e.message });
      throw e;
    }
  });

  app.delete("/teams/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const ok = await deleteSalesTeam(auth.organizationId, id);
    if (!ok) return reply.status(404).send({ error: "Equipe não encontrada" });
    return reply.status(204).send();
  });

  app.get("/sellers", async (req) => {
    const auth = req.auth!;
    return prisma.seller.findMany({
      where: sellerScopeWhere(auth),
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
        manager: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/sellers", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        commissionType: sellerCommissionTypeSchema.default("FIXED"),
        commissionPercent: z.number().min(0).max(100).optional(),
        teamId: z.string().min(1).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply
        .status(400)
        .send({ error: "Dados inválidos", details: body.error.flatten() });

    const { commissionType } = body.data;
    const commissionPercent =
      commissionType === "FIXED"
        ? (body.data.commissionPercent ?? 10)
        : (body.data.commissionPercent ?? 0);

    const email = body.data.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return reply.status(409).send({ error: "Email já cadastrado" });

    const passwordHash = await hashPassword(body.data.password);

    if (body.data.teamId) {
      const team = await prisma.salesTeam.findFirst({
        where: { id: body.data.teamId, organizationId: auth.organizationId },
        select: { id: true },
      });
      if (!team) return reply.status(400).send({ error: "Equipe inválida" });
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: body.data.name,
        role: "SELLER",
        organizationId: auth.organizationId,
        seller: {
          create: {
            organizationId: auth.organizationId,
            commissionType,
            commissionPercent,
            active: true,
            ...(body.data.teamId ? { teamId: body.data.teamId } : {}),
          },
        },
      },
      include: { seller: true },
    });

    return {
      id: user.seller!.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      commissionType: user.seller!.commissionType,
      commissionPercent: decToNum(user.seller!.commissionPercent),
      active: user.seller!.active,
    };
  });

  app.patch("/sellers/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        commissionType: sellerCommissionTypeSchema.optional(),
        commissionPercent: z.number().min(0).max(100).optional(),
        active: z.boolean().optional(),
        name: z.string().min(1).optional(),
        managerUserId: z.string().min(1).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const seller = await prisma.seller.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: { user: true },
    });
    if (!seller) return reply.status(404).send({ error: "Não encontrado" });

    if (body.data.managerUserId !== undefined) {
      const v = await validateManagerAssignment(
        auth.organizationId,
        body.data.managerUserId,
      );
      if (!v.ok) return reply.status(400).send({ error: v.error });
    }

    await prisma.$transaction([
      prisma.seller.update({
        where: { id },
        data: {
          commissionType: body.data.commissionType ?? undefined,
          commissionPercent: body.data.commissionPercent ?? undefined,
          active: body.data.active ?? undefined,
          ...(body.data.managerUserId !== undefined
            ? { managerUserId: body.data.managerUserId }
            : {}),
        },
      }),
      ...(body.data.name
        ? [
            prisma.user.update({
              where: { id: seller.userId },
              data: { name: body.data.name },
            }),
          ]
        : []),
    ]);

    return prisma.seller.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });
  });

  app.get("/sellers/:id/products", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const seller = await prisma.seller.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!seller)
      return reply.status(404).send({ error: "Vendedor não encontrado" });

    const links = await prisma.sellerProduct.findMany({
      where: { sellerId: id },
      include: { product: true },
    });
    return links.map((l) => l.product);
  });

  app.put("/sellers/:id/products", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({ productIds: z.array(z.string()) })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const seller = await prisma.seller.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!seller)
      return reply.status(404).send({ error: "Vendedor não encontrado" });

    const products = await prisma.product.findMany({
      where: {
        organizationId: auth.organizationId,
        id: { in: body.data.productIds },
      },
    });
    if (products.length !== body.data.productIds.length) {
      return reply.status(400).send({ error: "Algum produto é inválido" });
    }

    await prisma.sellerProduct.deleteMany({ where: { sellerId: id } });
    if (body.data.productIds.length) {
      await prisma.sellerProduct.createMany({
        data: body.data.productIds.map((productId) => ({
          sellerId: id,
          productId,
        })),
      });
    }
    return { ok: true };
  });

  /* --- Clientes --- */
  app.get("/customers", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({ sellerId: z.string().optional() })
      .safeParse(req.query);
    const where: Prisma.CustomerWhereInput = {
      organizationId: auth.organizationId,
    };
    if (q.success && q.data.sellerId) where.sellerId = q.data.sellerId;
    return prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        seller: { include: { user: { select: { name: true } } } },
        region: { select: { id: true, code: true, name: true } },
      },
    });
  });

  app.post("/customers", async (req, reply) => {
    const auth = req.auth!;
    const body = customerBodySchema.safeParse(req.body);
    if (!body.success)
      return reply
        .status(400)
        .send({ error: "Dados inválidos", details: body.error.flatten() });

    if (body.data.sellerId) {
      const s = await prisma.seller.findFirst({
        where: { id: body.data.sellerId, organizationId: auth.organizationId },
      });
      if (!s) return reply.status(400).send({ error: "Vendedor inválido" });
    }

    if (body.data.regionId) {
      const r = await prisma.region.findFirst({
        where: { id: body.data.regionId, organizationId: auth.organizationId },
      });
      if (!r) return reply.status(400).send({ error: "Região inválida" });
    }

    try {
      return await prisma.customer.create({
        data: {
          organizationId: auth.organizationId,
          ...toCustomerPrismaData(body.data, { includeCredit: true }),
        } as Prisma.CustomerUncheckedCreateInput,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return reply
          .status(409)
          .send({ error: "CNPJ ou CPF já cadastrado nesta organização." });
      }
      throw e;
    }
  });

  app.patch("/customers/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = customerPatchSchema.safeParse(req.body);
    if (!body.success)
      return reply
        .status(400)
        .send({ error: "Dados inválidos", details: body.error.flatten() });

    const existing = await prisma.customer.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    if (body.data.regionId) {
      const r = await prisma.region.findFirst({
        where: { id: body.data.regionId, organizationId: auth.organizationId },
      });
      if (!r) return reply.status(400).send({ error: "Região inválida" });
    }

    const merged: CustomerBodyInput = {
      name: body.data.name ?? existing.name,
      email: body.data.email !== undefined ? body.data.email : existing.email,
      phone: body.data.phone !== undefined ? body.data.phone : existing.phone,
      sellerId:
        body.data.sellerId !== undefined
          ? body.data.sellerId
          : existing.sellerId,
      regionId:
        body.data.regionId !== undefined
          ? body.data.regionId
          : existing.regionId,
      latitude:
        body.data.latitude !== undefined
          ? body.data.latitude
          : existing.latitude != null
            ? decToNum(existing.latitude)
            : null,
      longitude:
        body.data.longitude !== undefined
          ? body.data.longitude
          : existing.longitude != null
            ? decToNum(existing.longitude)
            : null,
      addressNote:
        body.data.addressNote !== undefined
          ? body.data.addressNote
          : existing.addressNote,
      documentType:
        body.data.documentType !== undefined
          ? body.data.documentType
          : (existing.documentType as CustomerBodyInput["documentType"]),
      cnpj: body.data.cnpj !== undefined ? body.data.cnpj : existing.cnpj,
      cpf: body.data.cpf !== undefined ? body.data.cpf : existing.cpf,
      legalName:
        body.data.legalName !== undefined
          ? body.data.legalName
          : existing.legalName,
      tradeName:
        body.data.tradeName !== undefined
          ? body.data.tradeName
          : existing.tradeName,
      cep: body.data.cep !== undefined ? body.data.cep : existing.cep,
      street:
        body.data.street !== undefined ? body.data.street : existing.street,
      number:
        body.data.number !== undefined ? body.data.number : existing.number,
      neighborhood:
        body.data.neighborhood !== undefined
          ? body.data.neighborhood
          : existing.neighborhood,
      state: body.data.state !== undefined ? body.data.state : existing.state,
      city: body.data.city !== undefined ? body.data.city : existing.city,
      cityIbgeCode:
        body.data.cityIbgeCode !== undefined
          ? body.data.cityIbgeCode
          : existing.cityIbgeCode,
      stateRegistration:
        body.data.stateRegistration !== undefined
          ? body.data.stateRegistration
          : existing.stateRegistration,
      buyerName:
        body.data.buyerName !== undefined
          ? body.data.buyerName
          : existing.buyerName,
      notes: body.data.notes !== undefined ? body.data.notes : existing.notes,
      creditLimit:
        body.data.creditLimit !== undefined
          ? body.data.creditLimit
          : existing.creditLimit != null
            ? decToNum(existing.creditLimit)
            : null,
      creditBlocked:
        body.data.creditBlocked !== undefined
          ? body.data.creditBlocked
          : existing.creditBlocked,
    };

    try {
      return await prisma.customer.update({
        where: { id },
        data: toCustomerPrismaData(merged, {
          includeCredit: true,
        }) as Prisma.CustomerUncheckedUpdateInput,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return reply
          .status(409)
          .send({ error: "CNPJ ou CPF já cadastrado nesta organização." });
      }
      throw e;
    }
  });

  app.delete("/customers/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const existing = await prisma.customer.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    await prisma.customer.delete({ where: { id } });
    return reply.status(204).send();
  });

  /* --- Visitas em campo (check-in/out no app do vendedor) --- */
  app.get("/customer-visits", async (req, reply) => {
    const auth = req.auth!;
    const q = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        sellerId: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(500).optional(),
      })
      .safeParse(req.query);
    if (!q.success)
      return reply.status(400).send({ error: "Parâmetros inválidos" });

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let fromDt = defaultFrom;
    if (q.data.from?.trim()) {
      const p = parseVisitPeriodDate(q.data.from, "start");
      if (!p)
        return reply
          .status(400)
          .send({ error: "Data inicial inválida (use YYYY-MM-DD ou ISO)" });
      fromDt = p;
    }

    let toDt = now;
    if (q.data.to?.trim()) {
      const p = parseVisitPeriodDate(q.data.to, "end");
      if (!p)
        return reply
          .status(400)
          .send({ error: "Data final inválida (use YYYY-MM-DD ou ISO)" });
      toDt = p;
    }

    if (fromDt > toDt)
      return reply
        .status(400)
        .send({ error: "O início do período deve ser antes do fim" });

    const sellerId = q.data.sellerId?.trim();
    const scope = sellerScopeWhere(auth);
    if (sellerId) {
      const sRow = await prisma.seller.findFirst({
        where: { id: sellerId, ...scope },
        select: { id: true },
      });
      if (!sRow) return reply.status(400).send({ error: "Vendedor inválido" });
    }

    const limit = q.data.limit ?? 300;

    const rows = await prisma.sellerCustomerVisit.findMany({
      where: {
        organizationId: auth.organizationId,
        checkedInAt: { gte: fromDt, lte: toDt },
        seller: scope,
        ...(sellerId ? { sellerId } : {}),
      },
      orderBy: { checkedInAt: "desc" },
      take: limit,
      include: {
        seller: { include: { user: { select: { name: true } } } },
        customer: {
          select: { id: true, name: true, latitude: true, longitude: true },
        },
      },
    });

    const visits = rows.map((v) => {
      const durationSeconds =
        v.checkedOutAt != null
          ? Math.round(
              (v.checkedOutAt.getTime() - v.checkedInAt.getTime()) / 1000,
            )
          : null;
      return {
        id: v.id,
        sellerId: v.sellerId,
        sellerName: v.seller.user.name,
        customerId: v.customerId,
        customerName: v.customer.name,
        customerLatitude:
          v.customer.latitude != null ? decToNum(v.customer.latitude) : null,
        customerLongitude:
          v.customer.longitude != null ? decToNum(v.customer.longitude) : null,
        checkedInAt: v.checkedInAt.toISOString(),
        checkedOutAt: v.checkedOutAt?.toISOString() ?? null,
        checkInLat: v.checkInLat != null ? decToNum(v.checkInLat) : null,
        checkInLng: v.checkInLng != null ? decToNum(v.checkInLng) : null,
        checkOutLat: v.checkOutLat != null ? decToNum(v.checkOutLat) : null,
        checkOutLng: v.checkOutLng != null ? decToNum(v.checkOutLng) : null,
        durationSeconds,
        openVisit: v.checkedOutAt == null,
        notes: v.notes,
      };
    });

    return {
      period: { from: fromDt.toISOString(), to: toDt.toISOString() },
      limit,
      visits,
    };
  });

  app.get("/seller-locations", async (req) => {
    const auth = req.auth!;
    return listAdminSellerLocations(auth);
  });

  app.get("/seller-locations/ws", { websocket: true }, (socket, req) => {
    const q = req.query as { access_token?: string };
    const token =
      typeof q.access_token === "string" ? q.access_token.trim() : "";
    if (!token) {
      socket.close(4401, "Token obrigatório");
      return;
    }
    let auth;
    try {
      auth = verifyAccessToken(token);
    } catch {
      socket.close(4401, "Token inválido");
      return;
    }
    if (!isOrgStaff(auth.role)) {
      socket.close(4403, "Sem permissão");
      return;
    }

    const role =
      auth.role === "MANAGER" ? ("MANAGER" as const) : ("ADMIN" as const);
    const unregister = registerSellerLocationClient(auth.organizationId, {
      socket,
      role,
      userId: auth.sub,
    });

    const heartbeat = setInterval(() => {
      if (socket.readyState === 1) socket.ping();
    }, 30_000);

    socket.on("close", () => {
      clearInterval(heartbeat);
      unregister();
    });
  });

  app.get("/sellers/:id/location-history", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const q = z.object({ date: z.string().optional() }).safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: "Query inválida" });
    const result = await getSellerLocationHistory(auth, reply, id, q.data.date);
    if (!result) return;
    return result;
  });

  /* --- Títulos / crédito do cliente --- */
  app.get("/customers/:customerId/credit-titles", async (req, reply) => {
    const auth = req.auth!;
    const { customerId } = z
      .object({ customerId: z.string().min(1) })
      .parse(req.params);
    const cust = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: auth.organizationId },
    });
    if (!cust) return reply.status(404).send({ error: "Não encontrado" });
    return prisma.customerCreditTitle.findMany({
      where: { organizationId: auth.organizationId, customerId },
      orderBy: [{ dueDate: "desc" }],
    });
  });

  app.post("/customers/:customerId/credit-titles", async (req, reply) => {
    const auth = req.auth!;
    const { customerId } = z
      .object({ customerId: z.string().min(1) })
      .parse(req.params);
    const cust = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: auth.organizationId },
    });
    if (!cust) return reply.status(404).send({ error: "Não encontrado" });

    const body = z
      .object({
        reference: z.string().nullable().optional(),
        amount: z.number().positive(),
        paidAmount: z.number().nonnegative().optional(),
        issueDate: z.string().datetime().optional(),
        dueDate: z.string().datetime(),
        notes: z.string().nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const paid = body.data.paidAmount ?? 0;
    if (paid > body.data.amount + 1e-6) {
      return reply
        .status(400)
        .send({ error: "Valor pago não pode ser maior que o título" });
    }

    return prisma.customerCreditTitle.create({
      data: {
        organizationId: auth.organizationId,
        customerId,
        reference: body.data.reference ?? null,
        amount: body.data.amount,
        paidAmount: paid,
        issueDate: body.data.issueDate
          ? new Date(body.data.issueDate)
          : undefined,
        dueDate: new Date(body.data.dueDate),
        notes: body.data.notes ?? null,
      },
    });
  });

  app.patch("/credit-titles/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        reference: z.string().nullable().optional(),
        amount: z.number().positive().optional(),
        paidAmount: z.number().nonnegative().optional(),
        issueDate: z.string().datetime().optional(),
        dueDate: z.string().datetime().optional(),
        notes: z.string().nullable().optional(),
        status: z.enum(["OPEN", "PAID", "CANCELLED"]).optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const existing = await prisma.customerCreditTitle.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    const amt =
      body.data.amount !== undefined
        ? body.data.amount
        : decToNum(existing.amount);
    let paid =
      body.data.paidAmount !== undefined
        ? body.data.paidAmount
        : decToNum(existing.paidAmount);
    let status = body.data.status ?? existing.status;

    if (status === "PAID") {
      paid = amt;
    }
    if (paid > amt + 1e-6) {
      return reply.status(400).send({ error: "Valor pago inválido" });
    }

    return prisma.customerCreditTitle.update({
      where: { id },
      data: {
        reference:
          body.data.reference === undefined ? undefined : body.data.reference,
        amount: body.data.amount ?? undefined,
        paidAmount: paid,
        issueDate: body.data.issueDate
          ? new Date(body.data.issueDate)
          : undefined,
        dueDate: body.data.dueDate ? new Date(body.data.dueDate) : undefined,
        notes: body.data.notes === undefined ? undefined : body.data.notes,
        status,
      },
    });
  });

  app.delete("/credit-titles/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const existing = await prisma.customerCreditTitle.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    await prisma.customerCreditTitle.delete({ where: { id } });
    return reply.status(204).send();
  });

  /* --- Notificações (admin; mesmo modelo que no app do vendedor) --- */
  app.get("/notifications", async (req) => {
    const auth = req.auth!;
    return prisma.notification.findMany({
      where: { userId: auth.sub },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

  app.get("/notifications/unread-count", async (req) => {
    const auth = req.auth!;
    const count = await prisma.notification.count({
      where: { userId: auth.sub, read: false },
    });
    return { count };
  });

  app.patch("/notifications/:id/read", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const n = await prisma.notification.findFirst({
      where: { id, userId: auth.sub },
    });
    if (!n) return reply.status(404).send({ error: "Não encontrado" });
    return prisma.notification.update({ where: { id }, data: { read: true } });
  });

  app.post("/notifications/read-all", async (req) => {
    const auth = req.auth!;
    await prisma.notification.updateMany({
      where: { userId: auth.sub, read: false },
      data: { read: true },
    });
    return { ok: true };
  });

  /* --- Pedidos (visão admin) --- */
  app.get("/orders", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({
        sellerId: z.string().optional(),
        status: z
          .enum(["DRAFT", "CONFIRMED", "CANCELLED", "PENDING_CREDIT_APPROVAL"])
          .optional(),
      })
      .safeParse(req.query);

    const where: Prisma.OrderWhereInput = {
      ...orderScopeWhere(auth),
    };
    if (q.success) {
      if (q.data.sellerId) where.sellerId = q.data.sellerId;
      if (q.data.status) where.status = q.data.status as OrderStatus;
    }

    return prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        seller: { include: { user: { select: { name: true, email: true } } } },
        customer: true,
        items: { include: { product: true } },
      },
    });
  });

  app.get("/orders/pending-credit-summary", async (req) => {
    const auth = req.auth!;
    const count = await prisma.order.count({
      where: {
        ...orderScopeWhere(auth),
        status: "PENDING_CREDIT_APPROVAL",
      },
    });
    return { count };
  });

  app.get("/orders/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const order = await prisma.order.findFirst({
      where: { id, ...orderScopeWhere(auth) },
      include: {
        seller: { include: { user: { select: { name: true, email: true } } } },
        customer: true,
        items: { include: { product: true } },
      },
    });
    if (!order) return reply.status(404).send({ error: "Não encontrado" });
    return order;
  });

  app.get("/orders/:id/pdf", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const scoped = orderScopeWhere(auth);
    const order = await prisma.order.findFirst({
      where: { id, ...scoped },
      include: {
        seller: { include: { user: { select: { name: true, email: true } } } },
        customer: true,
        items: { include: { product: { select: { sku: true } } } },
        organization: { select: { name: true, displayName: true } },
      },
    });
    if (!order) return reply.status(404).send({ error: "Não encontrado" });
    return sendOrderPdfReply(reply, order);
  });

  app.patch("/orders/:id/status", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        status: z.enum([
          "DRAFT",
          "CONFIRMED",
          "CANCELLED",
          "PENDING_CREDIT_APPROVAL",
        ]),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const existing = await prisma.order.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    try {
      await applyStockOnStatusChange(id, existing.status, body.data.status);
    } catch (e) {
      if (e instanceof StockError)
        return reply.status(400).send({ error: e.message });
      throw e;
    }

    return prisma.order.update({
      where: { id },
      data: { status: body.data.status },
    });
  });

  app.post("/orders", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        sellerId: z.string(),
        customerId: z.string().optional(),
        status: z
          .enum(["DRAFT", "CONFIRMED", "CANCELLED", "PENDING_CREDIT_APPROVAL"])
          .optional(),
        notes: z.string().optional(),
        items: z
          .array(
            z.object({
              productId: z.string(),
              quantity: z.number().int().positive(),
            }),
          )
          .min(1),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const seller = await prisma.seller.findFirst({
      where: { id: body.data.sellerId, organizationId: auth.organizationId },
    });
    if (!seller) return reply.status(400).send({ error: "Vendedor inválido" });

    if (body.data.customerId) {
      const c = await prisma.customer.findFirst({
        where: {
          id: body.data.customerId,
          organizationId: auth.organizationId,
        },
      });
      if (!c) return reply.status(400).send({ error: "Cliente inválido" });
    }

    try {
      const sale = await computeSaleOrder({
        organizationId: auth.organizationId,
        sellerId: body.data.sellerId,
        customerId: body.data.customerId ?? null,
        items: body.data.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });

      const orderStatus = body.data.status ?? "CONFIRMED";

      if (orderStatus === "CONFIRMED") {
        await assertSufficientStock(
          auth.organizationId,
          sale.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
        );
      }

      const order = await prisma.order.create({
        data: {
          organizationId: auth.organizationId,
          sellerId: body.data.sellerId,
          customerId: body.data.customerId,
          status: orderStatus,
          totalAmount: sale.netTotal,
          comboDiscountTotal: sale.comboDiscountTotal,
          notes: body.data.notes,
          items: {
            create: sale.lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              productName: l.productName,
              commissionPercent: l.commissionPercent,
              commissionAmount: l.commissionAmount,
            })),
          },
        },
        include: {
          items: true,
          seller: { include: { user: true } },
          customer: true,
        },
      });

      if (order.status === "CONFIRMED") {
        await applyStockOnStatusChange(order.id, "DRAFT", "CONFIRMED");
      }

      return order;
    } catch (e) {
      if (e instanceof OrderPricingError)
        return reply.status(400).send({ error: e.message });
      if (e instanceof StockError)
        return reply.status(400).send({ error: e.message });
      throw e;
    }
  });

  /* --- Combos --- */
  app.get("/product-combos", async (req) => {
    const auth = req.auth!;
    return prisma.productCombo.findMany({
      where: { organizationId: auth.organizationId },
      include: {
        lines: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });
  });

  app.post("/product-combos", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        name: z.string().min(1),
        label: z.string().nullable().optional(),
        active: z.boolean().optional(),
        validFrom: z.string().datetime().nullable().optional(),
        validTo: z.string().datetime().nullable().optional(),
        priority: z.number().int().optional(),
        kind: z.enum(["FIXED_PER_COMPLETE_SET", "PERCENT_OF_SET_SUBTOTAL"]),
        value: z.number().nonnegative(),
        lines: z
          .array(
            z.object({
              productId: z.string(),
              quantity: z.number().int().positive(),
            }),
          )
          .min(1),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const ids = [...new Set(body.data.lines.map((l) => l.productId))];
    const count = await prisma.product.count({
      where: { organizationId: auth.organizationId, id: { in: ids } },
    });
    if (count !== ids.length)
      return reply
        .status(400)
        .send({ error: "Um ou mais produtos são inválidos" });

    const d = body.data;
    const combo = await prisma.productCombo.create({
      data: {
        organizationId: auth.organizationId,
        name: d.name.trim(),
        label: d.label === undefined ? null : d.label,
        active: d.active ?? true,
        validFrom: d.validFrom ? new Date(d.validFrom) : null,
        validTo: d.validTo ? new Date(d.validTo) : null,
        priority: d.priority ?? 0,
        kind: d.kind,
        value: d.value,
        lines: {
          create: d.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        },
      },
      include: {
        lines: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });
    return combo;
  });

  app.patch("/product-combos/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        label: z.string().nullable().optional(),
        active: z.boolean().optional(),
        validFrom: z.string().datetime().nullable().optional(),
        validTo: z.string().datetime().nullable().optional(),
        priority: z.number().int().optional(),
        kind: z
          .enum(["FIXED_PER_COMPLETE_SET", "PERCENT_OF_SET_SUBTOTAL"])
          .optional(),
        value: z.number().nonnegative().optional(),
        lines: z
          .array(
            z.object({
              productId: z.string(),
              quantity: z.number().int().positive(),
            }),
          )
          .min(1)
          .optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const existing = await prisma.productCombo.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    const d = body.data;
    if (d.lines) {
      const ids = [...new Set(d.lines.map((l) => l.productId))];
      const cnt = await prisma.product.count({
        where: { organizationId: auth.organizationId, id: { in: ids } },
      });
      if (cnt !== ids.length)
        return reply
          .status(400)
          .send({ error: "Um ou mais produtos são inválidos" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.productCombo.update({
        where: { id },
        data: {
          name: d.name?.trim(),
          label: d.label === undefined ? undefined : d.label,
          active: d.active ?? undefined,
          validFrom:
            d.validFrom === undefined
              ? undefined
              : d.validFrom
                ? new Date(d.validFrom)
                : null,
          validTo:
            d.validTo === undefined
              ? undefined
              : d.validTo
                ? new Date(d.validTo)
                : null,
          priority: d.priority ?? undefined,
          kind: d.kind ?? undefined,
          value: d.value ?? undefined,
        },
      });
      if (d.lines) {
        await tx.productComboLine.deleteMany({ where: { comboId: id } });
        await tx.productComboLine.createMany({
          data: d.lines.map((line) => ({
            comboId: id,
            productId: line.productId,
            quantity: line.quantity,
          })),
        });
      }
    });

    return prisma.productCombo.findFirst({
      where: { id },
      include: {
        lines: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });
  });

  app.delete("/product-combos/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const existing = await prisma.productCombo.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    await prisma.productCombo.delete({ where: { id } });
    return reply.status(204).send();
  });

  /* --- Comissão variável por vendedor --- */
  app.get("/seller-commission-rules", async (req, reply) => {
    const auth = req.auth!;
    const q = z.object({ sellerId: z.string().min(1) }).safeParse(req.query);
    if (!q.success)
      return reply.status(400).send({ error: "Informe sellerId na query" });

    const seller = await prisma.seller.findFirst({
      where: { id: q.data.sellerId, organizationId: auth.organizationId },
    });
    if (!seller)
      return reply.status(404).send({ error: "Vendedor não encontrado" });

    return prisma.sellerCommissionRule.findMany({
      where: { organizationId: auth.organizationId, sellerId: q.data.sellerId },
      include: {
        product: { select: { id: true, name: true } },
        category: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  });

  app.post("/seller-commission-rules", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        sellerId: z.string(),
        productId: z.string().nullable().optional(),
        categoryId: z.string().nullable().optional(),
        commissionPercent: z.number().min(0).max(100),
        priority: z.number().int().optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const d = body.data;
    const seller = await prisma.seller.findFirst({
      where: { id: d.sellerId, organizationId: auth.organizationId },
    });
    if (!seller) return reply.status(400).send({ error: "Vendedor inválido" });

    if (d.productId) {
      const p = await prisma.product.findFirst({
        where: { id: d.productId, organizationId: auth.organizationId },
      });
      if (!p) return reply.status(400).send({ error: "Produto inválido" });
    }
    if (d.categoryId) {
      const c = await prisma.productCategory.findFirst({
        where: { id: d.categoryId, organizationId: auth.organizationId },
      });
      if (!c) return reply.status(400).send({ error: "Categoria inválida" });
    }

    return prisma.sellerCommissionRule.create({
      data: {
        organizationId: auth.organizationId,
        sellerId: d.sellerId,
        productId: d.productId ?? null,
        categoryId: d.categoryId ?? null,
        commissionPercent: d.commissionPercent,
        priority: d.priority ?? 0,
        active: d.active ?? true,
      },
      include: {
        product: { select: { id: true, name: true } },
        category: { select: { id: true, code: true, name: true } },
      },
    });
  });

  app.patch("/seller-commission-rules/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        productId: z.string().nullable().optional(),
        categoryId: z.string().nullable().optional(),
        commissionPercent: z.number().min(0).max(100).optional(),
        priority: z.number().int().optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const existing = await prisma.sellerCommissionRule.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    const d = body.data;
    if (d.productId) {
      const p = await prisma.product.findFirst({
        where: { id: d.productId, organizationId: auth.organizationId },
      });
      if (!p) return reply.status(400).send({ error: "Produto inválido" });
    }
    if (d.categoryId) {
      const c = await prisma.productCategory.findFirst({
        where: { id: d.categoryId, organizationId: auth.organizationId },
      });
      if (!c) return reply.status(400).send({ error: "Categoria inválida" });
    }

    return prisma.sellerCommissionRule.update({
      where: { id },
      data: {
        productId: d.productId === undefined ? undefined : d.productId,
        categoryId: d.categoryId === undefined ? undefined : d.categoryId,
        commissionPercent: d.commissionPercent ?? undefined,
        priority: d.priority ?? undefined,
        active: d.active ?? undefined,
      },
      include: {
        product: { select: { id: true, name: true } },
        category: { select: { id: true, code: true, name: true } },
      },
    });
  });

  app.delete("/seller-commission-rules/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const existing = await prisma.sellerCommissionRule.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    await prisma.sellerCommissionRule.delete({ where: { id } });
    return reply.status(204).send();
  });

  /* --- Faixas de comissão progressiva (por faturamento MTD) --- */
  app.get("/commission-progressive-tiers", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({ sellerId: z.string().optional() })
      .safeParse(req.query);
    const where: Prisma.CommissionProgressiveTierWhereInput = {
      organizationId: auth.organizationId,
    };
    if (q.success && q.data.sellerId) where.sellerId = q.data.sellerId;
    return prisma.commissionProgressiveTier.findMany({
      where,
      orderBy: [{ sellerId: "asc" }, { thresholdAmount: "asc" }],
      include: {
        seller: { include: { user: { select: { name: true } } } },
      },
    });
  });

  app.post("/commission-progressive-tiers", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        sellerId: z.string().nullable().optional(),
        thresholdAmount: z.number().nonnegative(),
        commissionPercent: z.number().min(0).max(100),
        label: z.string().nullable().optional(),
        priority: z.number().int().optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });
    const d = body.data;
    if (d.sellerId) {
      const s = await prisma.seller.findFirst({
        where: { id: d.sellerId, organizationId: auth.organizationId },
      });
      if (!s) return reply.status(400).send({ error: "Vendedor inválido" });
    }
    return prisma.commissionProgressiveTier.create({
      data: {
        organizationId: auth.organizationId,
        sellerId: d.sellerId ?? null,
        thresholdAmount: d.thresholdAmount,
        commissionPercent: d.commissionPercent,
        label: d.label ?? null,
        priority: d.priority ?? 0,
        active: d.active ?? true,
      },
    });
  });

  app.patch("/commission-progressive-tiers/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        sellerId: z.string().nullable().optional(),
        thresholdAmount: z.number().nonnegative().optional(),
        commissionPercent: z.number().min(0).max(100).optional(),
        label: z.string().nullable().optional(),
        priority: z.number().int().optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const existing = await prisma.commissionProgressiveTier.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    const d = body.data;
    if (d.sellerId) {
      const s = await prisma.seller.findFirst({
        where: { id: d.sellerId, organizationId: auth.organizationId },
      });
      if (!s) return reply.status(400).send({ error: "Vendedor inválido" });
    }

    return prisma.commissionProgressiveTier.update({
      where: { id },
      data: {
        sellerId: d.sellerId === undefined ? undefined : d.sellerId,
        thresholdAmount: d.thresholdAmount ?? undefined,
        commissionPercent: d.commissionPercent ?? undefined,
        label: d.label === undefined ? undefined : d.label,
        priority: d.priority ?? undefined,
        active: d.active ?? undefined,
      },
    });
  });

  app.delete("/commission-progressive-tiers/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const existing = await prisma.commissionProgressiveTier.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    await prisma.commissionProgressiveTier.delete({ where: { id } });
    return reply.status(204).send();
  });

  /* --- Metas mensais por vendedor --- */
  app.get("/seller-monthly-goals", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({
        sellerId: z.string().optional(),
        year: z.coerce.number().int().optional(),
        month: z.coerce.number().int().min(1).max(12).optional(),
      })
      .safeParse(req.query);
    const where: Prisma.SellerMonthlyGoalWhereInput = {
      organizationId: auth.organizationId,
    };
    if (q.success) {
      if (q.data.sellerId) where.sellerId = q.data.sellerId;
      if (q.data.year != null) where.year = q.data.year;
      if (q.data.month != null) where.month = q.data.month;
    }
    return prisma.sellerMonthlyGoal.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }, { sellerId: "asc" }],
      include: {
        seller: { include: { user: { select: { name: true } } } },
      },
    });
  });

  app.post("/seller-monthly-goals", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        sellerId: z.string(),
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        title: z.string().min(1).optional(),
        targetAmount: z.number().positive(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const d = body.data;
    const seller = await prisma.seller.findFirst({
      where: { id: d.sellerId, organizationId: auth.organizationId },
    });
    if (!seller) return reply.status(400).send({ error: "Vendedor inválido" });

    return prisma.sellerMonthlyGoal.upsert({
      where: {
        organizationId_sellerId_year_month: {
          organizationId: auth.organizationId,
          sellerId: d.sellerId,
          year: d.year,
          month: d.month,
        },
      },
      create: {
        organizationId: auth.organizationId,
        sellerId: d.sellerId,
        year: d.year,
        month: d.month,
        title: d.title?.trim() ?? "Meta do mês",
        targetAmount: d.targetAmount,
      },
      update: {
        title: d.title?.trim(),
        targetAmount: d.targetAmount,
      },
      include: {
        seller: { include: { user: { select: { name: true } } } },
      },
    });
  });

  app.patch("/seller-monthly-goals/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        title: z.string().min(1).optional(),
        targetAmount: z.number().positive().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const existing = await prisma.sellerMonthlyGoal.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    return prisma.sellerMonthlyGoal.update({
      where: { id },
      data: {
        title: body.data.title?.trim(),
        targetAmount: body.data.targetAmount ?? undefined,
      },
      include: {
        seller: { include: { user: { select: { name: true } } } },
      },
    });
  });

  app.delete("/seller-monthly-goals/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const existing = await prisma.sellerMonthlyGoal.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });
    await prisma.sellerMonthlyGoal.delete({ where: { id } });
    return reply.status(204).send();
  });

  /** Painel simples — vendas do dia, carteira “parada”, produtos sem giro, clientes sem compra. */
  app.get("/reports/insights", async (req, reply) => {
    const auth = req.auth!;
    if (isTeamLeaderAuth(auth)) {
      return reply.status(403).send({
        error: "Relatórios avançados não disponíveis para líderes de equipe",
      });
    }
    return buildDistributorInsights(auth.organizationId);
  });

  app.get("/reports/team-summary", async (req, reply) => {
    const auth = req.auth!;
    const q = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        teamId: z.string().optional(),
      })
      .safeParse(req.query);

    let sellerIds: string[];
    let teamName: string | null = null;

    if (isTeamLeaderAuth(auth)) {
      const teamId = auth.teamLeaderTeamId!;
      sellerIds = await teamMemberSellerIds(teamId);
      const team = await getSalesTeam(auth.organizationId, teamId);
      teamName = team?.name ?? null;
    } else if (q.success && q.data.teamId) {
      const team = await getSalesTeam(auth.organizationId, q.data.teamId);
      if (!team)
        return reply.status(404).send({ error: "Equipe não encontrada" });
      sellerIds = team.members.map((m) => m.id);
      teamName = team.name;
    } else {
      return reply
        .status(400)
        .send({ error: "Informe teamId ou acesse como líder de equipe" });
    }

    return buildTeamSalesSummary({
      organizationId: auth.organizationId,
      sellerIds,
      teamName,
      from: q.success ? q.data.from : undefined,
      to: q.success ? q.data.to : undefined,
    });
  });

  app.get("/reports/sales-by-supplier", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(20).optional(),
      })
      .safeParse(req.query);

    let sellerIds: string[] | undefined;
    if (auth.role === "MANAGER" || isTeamLeaderAuth(auth)) {
      const sellers = await prisma.seller.findMany({
        where: sellerScopeWhere(auth),
        select: { id: true },
      });
      sellerIds = sellers.map((s) => s.id);
    }

    return buildSalesBySupplier({
      organizationId: auth.organizationId,
      sellerIds,
      from: q.success ? q.data.from : undefined,
      to: q.success ? q.data.to : undefined,
      limit: q.success ? q.data.limit : undefined,
    });
  });

  /* --- Relatório PDF --- */
  app.get("/reports/sales.pdf", async (req, reply) => {
    const auth = req.auth!;
    const q = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        sellerId: z.string().optional(),
      })
      .safeParse(req.query);

    const where: Prisma.OrderWhereInput = {
      organizationId: auth.organizationId,
      status: "CONFIRMED",
    };
    if (q.success && q.data.sellerId) where.sellerId = q.data.sellerId;
    const createdAt: Prisma.DateTimeFilter = {};
    if (q.success && q.data.from) createdAt.gte = new Date(q.data.from);
    if (q.success && q.data.to) createdAt.lte = new Date(q.data.to);
    if (Object.keys(createdAt).length) where.createdAt = createdAt;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        seller: { include: { user: { select: { name: true } } } },
        customer: true,
        items: true,
      },
    });

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(18).text("Relatório de vendas", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, {
      align: "right",
    });
    doc.moveDown();

    let sum = 0;
    for (const o of orders) {
      const amount = decToNum(o.totalAmount);
      sum += amount;
      doc.fontSize(12).text(`Pedido ${o.id.slice(0, 8)}… — ${o.status}`, {
        continued: false,
      });
      doc
        .fontSize(10)
        .text(
          `Vendedor: ${o.seller.user.name} | Cliente: ${o.customer?.name ?? "-"} | Total: R$ ${amount.toFixed(2)} | ${o.createdAt.toISOString()}`,
        );
      for (const it of o.items) {
        doc.text(
          `  • ${it.productName} x${it.quantity} @ R$ ${decToNum(it.unitPrice).toFixed(2)} = R$ ${(decToNum(it.unitPrice) * it.quantity).toFixed(2)}`,
        );
      }
      doc.moveDown(0.5);
    }
    doc
      .fontSize(12)
      .text(`Total geral: R$ ${sum.toFixed(2)}`, { align: "right" });
    doc.end();

    const pdf = await done;
    return reply
      .header("Content-Type", "application/pdf")
      .header(
        "Content-Disposition",
        'attachment; filename="relatorio-vendas.pdf"',
      )
      .send(pdf);
  });
};
