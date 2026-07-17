import type { OrderStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  notifyAdminsCreditPending,
  notifySaleConfirmed,
} from "../services/admin-notifications.js";
import { getWebPushPublicKey } from "../services/notify.js";
import {
  handleRegisterPushDevice,
  handleUnregisterPushDevice,
} from "../services/push-device-routes.js";
import { buildSellerCommissionDashboard } from "../services/commission-dashboard.js";
import {
  buildSellerCustomerCreditSnapshot,
  evaluateOrderCredit,
  violationsToJson,
} from "../services/credit.js";
import {
  customerBodySchema,
  customerPatchSchema,
  toCustomerPrismaData,
  type CustomerBodyInput,
} from "../services/customer-validation.js";
import { isGoogleRoutesConfigured } from "../services/google-routes.js";
import {
  loadOrderForPdf,
  sendOrderPdfReply,
} from "../services/order-pdf-load.js";
import {
  computeSaleOrder,
  OrderPricingError,
} from "../services/order-pricing.js";
import { resolveEffectiveUnitPrice } from "../services/price-resolve.js";
import {
  applyStockOnStatusChange,
  assertSufficientStock,
  StockError,
} from "../services/product-stock.js";
import { buildRouteDirections } from "../services/route-directions.js";
import { greedyNearestRoute, haversineKm } from "../services/route-plan.js";
import { buildSalesBySupplier } from "../services/sales-by-supplier.js";
import { recordSellerLocation } from "../services/seller-location-write.js";
import { decToNum } from "../util/money.js";

const idParam = z.object({ id: z.string().min(1) });

export const sellerRoutes: FastifyPluginAsync = async (app) => {
  app.addHook(
    "preHandler",
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.auth) {
        return reply.status(401).send({ error: "Não autorizado" });
      }
      if (req.auth.role !== "SELLER" || !req.auth.sellerId) {
        return reply.status(403).send({ error: "Apenas vendedores" });
      }
    },
  );

  app.get("/", async () => ({ ok: true, scope: "seller" as const }));

  /** Marca da organização (somente leitura; escopo sempre `auth.organizationId`). */
  app.get("/organization/branding", async (req, reply) => {
    const auth = req.auth!;
    const org = await prisma.organization.findFirst({
      where: { id: auth.organizationId },
      select: {
        name: true,
        displayName: true,
        logoUrl: true,
        primaryColor: true,
      },
    });
    if (!org)
      return reply.status(404).send({ error: "Organização não encontrada" });
    return {
      displayName: org.displayName ?? org.name,
      logoUrl: org.logoUrl,
      primaryColor: org.primaryColor,
    };
  });

  app.get("/me", async (req) => {
    const auth = req.auth!;
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      include: { seller: true },
    });
    return {
      id: user!.id,
      email: user!.email,
      name: user!.name,
      sellerId: auth.sellerId,
      commissionPercent: user!.seller
        ? decToNum(user!.seller.commissionPercent)
        : null,
    };
  });

  app.patch("/me", async (req, reply) => {
    const auth = req.auth!;
    const body = z.object({ name: z.string().min(1) }).safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });
    await prisma.user.update({
      where: { id: auth.sub },
      data: { name: body.data.name },
    });
    return { ok: true };
  });

  app.get("/commission-dashboard", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({
        year: z.coerce.number().int().min(2000).max(2100).optional(),
        month: z.coerce.number().int().min(1).max(12).optional(),
      })
      .safeParse(req.query);
    const ref =
      q.success && q.data.year != null && q.data.month != null
        ? new Date(q.data.year, q.data.month - 1, 12)
        : new Date();
    return buildSellerCommissionDashboard(
      auth.organizationId,
      auth.sellerId!,
      ref,
    );
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

    return buildSalesBySupplier({
      organizationId: auth.organizationId,
      sellerIds: [auth.sellerId!],
      from: q.success ? q.data.from : undefined,
      to: q.success ? q.data.to : undefined,
      limit: q.success ? q.data.limit : undefined,
    });
  });

  app.get("/sales", async (req) => {
    const auth = req.auth!;
    return prisma.order.findMany({
      where: { sellerId: auth.sellerId!, organizationId: auth.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        items: true,
      },
    });
  });

  app.get("/sales/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const order = await prisma.order.findFirst({
      where: {
        id,
        sellerId: auth.sellerId!,
        organizationId: auth.organizationId,
      },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!order) return reply.status(404).send({ error: "Não encontrado" });
    return order;
  });

  app.get("/sales/:id/pdf", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const order = await loadOrderForPdf({
      id,
      organizationId: auth.organizationId,
      sellerId: auth.sellerId!,
    });
    if (!order) return reply.status(404).send({ error: "Não encontrado" });
    return sendOrderPdfReply(reply, order);
  });

  app.post("/sales", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        customerId: z.string().optional(),
        /** Idempotência — mesmo valor em replay devolve o mesmo pedido (offline queue). */
        clientMutationId: z.string().min(8).max(80).optional(),
        status: z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]).optional(),
        notes: z.string().optional(),
        items: z
          .array(
            z.object({
              productId: z.string(),
              quantity: z.number().int().positive(),
              /** Desconto extra do vendedor sobre o preço já promocional (limitado por produto/org). */
              discountPercent: z.number().min(0).max(100).optional(),
            }),
          )
          .min(1),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const clientMutationId = body.data.clientMutationId?.trim();
    if (clientMutationId) {
      const dup = await prisma.order.findUnique({
        where: { clientMutationId },
        include: {
          items: true,
          customer: true,
          seller: { include: { user: { select: { name: true } } } },
        },
      });
      if (dup) {
        if (
          dup.sellerId !== auth.sellerId ||
          dup.organizationId !== auth.organizationId
        ) {
          return reply
            .status(403)
            .send({ error: "Pedido já registado por outra conta." });
        }
        return dup;
      }
    }

    if (body.data.customerId) {
      const c = await prisma.customer.findFirst({
        where: {
          id: body.data.customerId,
          organizationId: auth.organizationId,
          OR: [{ sellerId: null }, { sellerId: auth.sellerId }],
        },
      });
      if (!c) return reply.status(400).send({ error: "Cliente inválido" });
    }

    const allowed = await prisma.sellerProduct.findMany({
      where: { sellerId: auth.sellerId! },
      select: { productId: true },
    });
    const allowedSet = new Set(allowed.map((a) => a.productId));

    try {
      const sale = await computeSaleOrder({
        organizationId: auth.organizationId,
        sellerId: auth.sellerId!,
        customerId: body.data.customerId ?? null,
        items: body.data.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          discountPercent: i.discountPercent,
        })),
        allowedProductIds: allowedSet,
      });

      let orderStatus: OrderStatus = (body.data.status ??
        "CONFIRMED") as OrderStatus;
      let creditHoldPayload: Prisma.InputJsonValue | undefined;

      if (orderStatus === "CONFIRMED" && body.data.customerId) {
        const ev = await evaluateOrderCredit({
          organizationId: auth.organizationId,
          customerId: body.data.customerId,
          proposedOrderTotal: sale.netTotal,
        });
        if (ev.action === "BLOCK") {
          return reply.status(403).send({
            error: ev.violations.map((v) => v.message).join(" "),
            creditDenied: true,
            violations: ev.violations,
          });
        }
        if (ev.action === "APPROVAL") {
          orderStatus = "PENDING_CREDIT_APPROVAL";
          creditHoldPayload = violationsToJson(ev.violations);
        }
      }

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
          sellerId: auth.sellerId!,
          customerId: body.data.customerId,
          status: orderStatus,
          totalAmount: sale.netTotal,
          comboDiscountTotal: sale.comboDiscountTotal,
          notes: body.data.notes,
          ...(creditHoldPayload !== undefined
            ? { creditHoldReasons: creditHoldPayload }
            : {}),
          ...(clientMutationId ? { clientMutationId } : {}),
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
          customer: true,
          seller: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
      });

      if (order.status === "PENDING_CREDIT_APPROVAL") {
        await notifyAdminsCreditPending({
          organizationId: auth.organizationId,
          order: {
            id: order.id,
            totalAmount: order.totalAmount,
            sellerId: order.sellerId,
            seller: {
              user: order.seller.user,
              managerUserId: order.seller.managerUserId,
            },
            customer: order.customer,
          },
        });
      }

      if (order.status === "CONFIRMED") {
        await applyStockOnStatusChange(
          order.id,
          "DRAFT",
          "CONFIRMED",
          auth.sub,
        );
        void notifySaleConfirmed({
          organizationId: auth.organizationId,
          order: {
            id: order.id,
            totalAmount: order.totalAmount,
            sellerId: order.sellerId,
            seller: {
              user: order.seller.user,
              managerUserId: order.seller.managerUserId,
            },
            customer: order.customer,
          },
        });
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

  app.get("/products", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({ customerId: z.string().optional() })
      .safeParse(req.query);
    const customerId = q.success ? q.data.customerId : undefined;

    const links = await prisma.sellerProduct.findMany({
      where: { sellerId: auth.sellerId! },
      include: {
        product: {
          include: {
            category: { select: { id: true, code: true, name: true } },
            supplier: {
              select: {
                id: true,
                code: true,
                tradeName: true,
                legalName: true,
                cnpj: true,
              },
            },
          },
        },
      },
    });

    const org = await prisma.organization.findUnique({
      where: { id: auth.organizationId },
      select: { defaultMaxSellerDiscountPercent: true },
    });
    const defaultMaxSellerDisc = org
      ? decToNum(org.defaultMaxSellerDiscountPercent)
      : 50;

    let regionId: string | null = null;
    if (customerId) {
      const cust = await prisma.customer.findFirst({
        where: {
          id: customerId,
          organizationId: auth.organizationId,
          OR: [{ sellerId: null }, { sellerId: auth.sellerId }],
        },
        select: { regionId: true },
      });
      regionId = cust?.regionId ?? null;
    }

    const freqRows = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          sellerId: auth.sellerId!,
          organizationId: auth.organizationId,
          status: { not: "CANCELLED" },
        },
      },
      _sum: { quantity: true },
    });
    const soldQtyMap = new Map<string, number>(
      freqRows.map((r) => [r.productId, r._sum.quantity ?? 0]),
    );

    const at = new Date();
    const out = [];
    for (const l of links) {
      const p = l.product;
      const priced = await resolveEffectiveUnitPrice(
        auth.organizationId,
        p.id,
        {
          sellerId: auth.sellerId!,
          customerId: customerId ?? null,
          regionId,
          quantity: 1,
          at,
        },
      );
      out.push({
        ...p,
        catalogUnitPrice: priced.catalogUnitPrice,
        effectiveUnitPrice: priced.effectiveUnitPrice,
        promotionLabel: priced.promotionLabel,
        soldQty: soldQtyMap.get(p.id) ?? 0,
        maxSellerDiscountPercent:
          p.maxSellerDiscountPercent != null
            ? decToNum(p.maxSellerDiscountPercent)
            : null,
        minSaleUnitPrice:
          p.minSaleUnitPrice != null ? decToNum(p.minSaleUnitPrice) : null,
        maxSellerDiscountPercentEffective:
          p.maxSellerDiscountPercent != null
            ? decToNum(p.maxSellerDiscountPercent)
            : defaultMaxSellerDisc,
      });
    }

    out.sort((a, b) => {
      const dq = (b.soldQty ?? 0) - (a.soldQty ?? 0);
      if (dq !== 0) return dq;
      return a.name.localeCompare(b.name, "pt");
    });

    return out;
  });

  app.get("/customers", async (req) => {
    const auth = req.auth!;
    return prisma.customer.findMany({
      where: {
        organizationId: auth.organizationId,
        OR: [{ sellerId: auth.sellerId }, { sellerId: null }],
      },
      orderBy: { name: "asc" },
    });
  });

  app.get("/customers/:id", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const customer = await prisma.customer.findFirst({
      where: {
        id,
        organizationId: auth.organizationId,
        OR: [{ sellerId: auth.sellerId }, { sellerId: null }],
      },
    });
    if (!customer) return reply.status(404).send({ error: "Não encontrado" });
    return customer;
  });

  app.get("/customers/:id/credit", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const q = z
      .object({ previewAmount: z.coerce.number().nonnegative().optional() })
      .safeParse(req.query);
    try {
      return await buildSellerCustomerCreditSnapshot({
        organizationId: auth.organizationId,
        customerId: id,
        sellerId: auth.sellerId!,
        previewAmount: q.success ? q.data.previewAmount : undefined,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "CLIENT_NOT_FOUND") {
        return reply.status(404).send({ error: "Não encontrado" });
      }
      throw e;
    }
  });

  app.post("/customers", async (req, reply) => {
    const auth = req.auth!;
    const body = customerBodySchema.safeParse(req.body);
    if (!body.success)
      return reply
        .status(400)
        .send({ error: "Dados inválidos", details: body.error.flatten() });

    try {
      return await prisma.customer.create({
        data: {
          organizationId: auth.organizationId,
          sellerId: auth.sellerId,
          ...toCustomerPrismaData(body.data),
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
      where: {
        id,
        organizationId: auth.organizationId,
        sellerId: auth.sellerId,
      },
    });
    if (!existing) return reply.status(404).send({ error: "Não encontrado" });

    const merged: CustomerBodyInput = {
      name: body.data.name ?? existing.name,
      email: body.data.email !== undefined ? body.data.email : existing.email,
      phone: body.data.phone !== undefined ? body.data.phone : existing.phone,
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
    };

    try {
      return await prisma.customer.update({
        where: { id },
        data: toCustomerPrismaData(
          merged,
        ) as Prisma.CustomerUncheckedUpdateInput,
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

  type SellerVisitPayload = Prisma.SellerCustomerVisitGetPayload<{
    include: { customer: { select: { id: true; name: true } } };
  }>;

  function serializeSellerVisit(v: SellerVisitPayload) {
    const durationSeconds =
      v.checkedOutAt != null
        ? Math.round(
            (v.checkedOutAt.getTime() - v.checkedInAt.getTime()) / 1000,
          )
        : null;
    return {
      id: v.id,
      customerId: v.customerId,
      customerName: v.customer.name,
      checkedInAt: v.checkedInAt.toISOString(),
      checkedOutAt: v.checkedOutAt?.toISOString() ?? null,
      durationSeconds,
      secondsOpen:
        v.checkedOutAt == null
          ? Math.round((Date.now() - v.checkedInAt.getTime()) / 1000)
          : null,
      checkInLat: v.checkInLat != null ? decToNum(v.checkInLat) : null,
      checkInLng: v.checkInLng != null ? decToNum(v.checkInLng) : null,
      checkOutLat: v.checkOutLat != null ? decToNum(v.checkOutLat) : null,
      checkOutLng: v.checkOutLng != null ? decToNum(v.checkOutLng) : null,
      notes: v.notes,
    };
  }

  app.get("/route-plan/nearby", async (req, reply) => {
    const auth = req.auth!;
    const q = z
      .object({
        lat: z.coerce.number().gte(-90).lte(90),
        lng: z.coerce.number().gte(-180).lte(180),
        radiusKm: z.coerce.number().positive().max(500).optional(),
      })
      .safeParse(req.query);
    if (!q.success)
      return reply
        .status(400)
        .send({ error: "Informe lat e lng válidos na query" });

    const radiusKm = q.data.radiusKm ?? 80;

    const rows = await prisma.customer.findMany({
      where: {
        organizationId: auth.organizationId,
        OR: [{ sellerId: auth.sellerId }, { sellerId: null }],
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        addressNote: true,
        sellerId: true,
      },
    });

    const customers = rows
      .map((c) => {
        const plat = decToNum(c.latitude);
        const plng = decToNum(c.longitude);
        const distanceKm = haversineKm(q.data.lat, q.data.lng, plat, plng);
        return {
          id: c.id,
          name: c.name,
          latitude: plat,
          longitude: plng,
          addressNote: c.addressNote,
          distanceKm: Math.round(distanceKm * 100) / 100,
          assignedToMe: c.sellerId === auth.sellerId,
        };
      })
      .filter((x) => x.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return {
      origin: { lat: q.data.lat, lng: q.data.lng },
      radiusKm,
      customers,
      roadRoutingConfigured: isGoogleRoutesConfigured(),
      disclaimerAirKm:
        "Distâncias em linha reta (km). Toque «Rota por estrada» para traçado pelas vias (Google Routes).",
    };
  });

  app.post("/route-plan/optimize-order", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        originLat: z.number().gte(-90).lte(90),
        originLng: z.number().gte(-180).lte(180),
        customerIds: z.array(z.string()).min(1).max(24),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const rows = await prisma.customer.findMany({
      where: {
        id: { in: body.data.customerIds },
        organizationId: auth.organizationId,
        OR: [{ sellerId: auth.sellerId }, { sellerId: null }],
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, name: true, latitude: true, longitude: true },
    });

    const missingCoords = body.data.customerIds.filter(
      (cid) => !rows.some((r) => r.id === cid),
    );
    if (missingCoords.length > 0) {
      return reply.status(400).send({
        error:
          "Todos os clientes precisam existir e ter latitude/longitude cadastradas.",
        missingCustomerIds: missingCoords,
      });
    }

    const stops = rows.map((r) => ({
      id: r.id,
      lat: decToNum(r.latitude),
      lng: decToNum(r.longitude),
    }));

    const route = greedyNearestRoute(
      body.data.originLat,
      body.data.originLng,
      stops,
    );

    const orderedCustomers = route.orderedIds.map((oid) => {
      const r = rows.find((x) => x.id === oid)!;
      return {
        id: r.id,
        name: r.name,
        latitude: decToNum(r.latitude),
        longitude: decToNum(r.longitude),
      };
    });

    return {
      heuristic: "nearest_neighbor_air_distance",
      orderedCustomerIds: route.orderedIds,
      legKm: route.legKm,
      totalKmApprox: route.totalKm,
      orderedCustomers,
    };
  });

  app.post("/route-plan/directions", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        originLat: z.number().gte(-90).lte(90),
        originLng: z.number().gte(-180).lte(180),
        customerIds: z.array(z.string()).min(1).max(24),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const rows = await prisma.customer.findMany({
      where: {
        id: { in: body.data.customerIds },
        organizationId: auth.organizationId,
        OR: [{ sellerId: auth.sellerId }, { sellerId: null }],
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, name: true, latitude: true, longitude: true },
    });

    const missingCoords = body.data.customerIds.filter(
      (cid) => !rows.some((r) => r.id === cid),
    );
    if (missingCoords.length > 0) {
      return reply.status(400).send({
        error:
          "Todos os clientes precisam existir e ter latitude/longitude cadastradas.",
        missingCustomerIds: missingCoords,
      });
    }

    const customers = rows.map((r) => ({
      id: r.id,
      name: r.name,
      latitude: decToNum(r.latitude),
      longitude: decToNum(r.longitude),
    }));

    const result = await buildRouteDirections(
      auth.organizationId,
      body.data.originLat,
      body.data.originLng,
      customers,
    );

    return {
      ...result,
      totalKmApprox: result.totalKm,
    };
  });

  app.get("/visits/active", async (req) => {
    const auth = req.auth!;
    const v = await prisma.sellerCustomerVisit.findFirst({
      where: { sellerId: auth.sellerId!, checkedOutAt: null },
      orderBy: { checkedInAt: "desc" },
      include: { customer: { select: { id: true, name: true } } },
    });
    return v ? serializeSellerVisit(v) : null;
  });

  app.get("/visits/recent", async (req) => {
    const auth = req.auth!;
    const q = z
      .object({ limit: z.coerce.number().int().min(1).max(100).optional() })
      .safeParse(req.query);
    const limit = q.success ? (q.data.limit ?? 40) : 40;
    const rows = await prisma.sellerCustomerVisit.findMany({
      where: { sellerId: auth.sellerId! },
      orderBy: { checkedInAt: "desc" },
      take: limit,
      include: { customer: { select: { id: true, name: true } } },
    });
    return rows.map(serializeSellerVisit);
  });

  app.post("/visits/check-in", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        customerId: z.string().min(1),
        latitude: z.number().gte(-90).lte(90).optional(),
        longitude: z.number().gte(-180).lte(180).optional(),
        notes: z.string().max(1000).optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const existingOpen = await prisma.sellerCustomerVisit.findFirst({
      where: { sellerId: auth.sellerId!, checkedOutAt: null },
    });
    if (existingOpen) {
      return reply.status(409).send({
        error:
          "Já existe uma visita em aberto. Faça check-out antes de iniciar outra.",
        activeVisitId: existingOpen.id,
      });
    }

    const cust = await prisma.customer.findFirst({
      where: {
        id: body.data.customerId,
        organizationId: auth.organizationId,
        OR: [{ sellerId: auth.sellerId }, { sellerId: null }],
      },
      select: { id: true },
    });
    if (!cust)
      return reply.status(404).send({ error: "Cliente não encontrado" });

    const visit = await prisma.sellerCustomerVisit.create({
      data: {
        organizationId: auth.organizationId,
        sellerId: auth.sellerId!,
        customerId: body.data.customerId,
        notes: body.data.notes,
        checkInLat: body.data.latitude,
        checkInLng: body.data.longitude,
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    return serializeSellerVisit(visit);
  });

  app.patch("/visits/:id/check-out", async (req, reply) => {
    const auth = req.auth!;
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        latitude: z.number().gte(-90).lte(90).optional(),
        longitude: z.number().gte(-180).lte(180).optional(),
        notes: z.string().max(1000).optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const visit = await prisma.sellerCustomerVisit.findFirst({
      where: {
        id,
        sellerId: auth.sellerId!,
        organizationId: auth.organizationId,
      },
      include: { customer: { select: { id: true, name: true } } },
    });
    if (!visit) return reply.status(404).send({ error: "Não encontrado" });
    if (visit.checkedOutAt)
      return reply.status(400).send({ error: "Esta visita já foi encerrada" });

    const updated = await prisma.sellerCustomerVisit.update({
      where: { id },
      data: {
        checkedOutAt: new Date(),
        checkOutLat: body.data.latitude,
        checkOutLng: body.data.longitude,
        ...(body.data.notes !== undefined
          ? {
              notes: visit.notes
                ? `${visit.notes}\n---\n${body.data.notes}`
                : body.data.notes,
            }
          : {}),
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    return serializeSellerVisit(updated);
  });

  app.post("/location", async (req, reply) => {
    const auth = req.auth!;
    const body = z
      .object({
        latitude: z.number().gte(-90).lte(90),
        longitude: z.number().gte(-180).lte(180),
        accuracyMeters: z.number().positive().optional(),
      })
      .safeParse(req.body);
    if (!body.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    const result = await recordSellerLocation({
      sellerId: auth.sellerId!,
      organizationId: auth.organizationId,
      latitude: body.data.latitude,
      longitude: body.data.longitude,
      accuracyMeters: body.data.accuracyMeters,
    });

    return { ok: true, recordedAt: result.recordedAt };
  });

  app.get("/notifications", async (req) => {
    const auth = req.auth!;
    return prisma.notification.findMany({
      where: { userId: auth.sub },
      orderBy: { createdAt: "desc" },
    });
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

  app.get("/push-vapid-public-key", async () => {
    const publicKey = getWebPushPublicKey();
    return { publicKey };
  });

  app.post("/push-devices", async (req, reply) => {
    const auth = req.auth!;
    const result = await handleRegisterPushDevice(auth.sub, req.body);
    if ("error" in result)
      return reply.status(result.status).send({ error: result.error });
    return result;
  });

  app.delete("/push-devices", async (req, reply) => {
    const auth = req.auth!;
    const result = await handleUnregisterPushDevice(auth.sub, req.body);
    if ("error" in result)
      return reply.status(result.status).send({ error: result.error });
    return result;
  });
};
