import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cnpjDigitsOnly, isValidCnpj } from "@pedidos/shared";
import { signAccessToken } from "../auth/jwt.js";
import { hashPassword } from "../auth/password.js";
import { prisma } from "../db.js";
import { buildApp } from "../app.js";
import {
  createEstablishment,
  getPrimaryEstablishment,
  userCanAccessEstablishment,
} from "../services/establishments.js";
import { createSaleOrder } from "../services/create-sale-order.js";
import { ensureDefaultOrderSituations } from "../services/order-situations.js";

const hasDb = Boolean(
  process.env.DATABASE_URL?.trim() && process.env.JWT_SECRET?.trim(),
);

/** Gera CNPJ válido único a partir de um prefixo numérico. */
function uniqueValidCnpj(prefix14ish: string): string {
  const base = `${prefix14ish.replace(/\D/g, "")}00000000000000`.slice(0, 12);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digit = (nums: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(nums[i]) * weights[i]!;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = digit(base, w1);
  const d2 = digit(`${base}${d1}`, w2);
  const cnpj = `${base}${d1}${d2}`;
  expect(isValidCnpj(cnpj)).toBe(true);
  return cnpj;
}

describe.skipIf(!hasDb)("multi-CNPJ / estabelecimentos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let orgId: string;
  let adminToken: string;
  let managerToken: string;
  let adminUserId: string;
  let managerUserId: string;
  let sellerId: string;
  let customerId: string;
  let productId: string;
  let payId: string;
  let primaryId: string;
  let secondaryId: string;
  const cnpj1 = uniqueValidCnpj(`1${stamp.slice(0, 10)}`);
  const cnpj2 = uniqueValidCnpj(`2${stamp.slice(0, 10)}`);

  beforeAll(async () => {
    app = await buildApp();
    const passwordHash = await hashPassword("est-multi-cnpj-test");

    const org = await prisma.organization.create({
      data: {
        name: `Multi CNPJ ${stamp}`,
        displayName: `Multi CNPJ ${stamp}`,
        accessStatus: "ACTIVE",
        document: cnpj1,
        cnpj: cnpj1,
      },
    });
    orgId = org.id;

    await prisma.organizationSubscription.create({
      data: {
        organizationId: orgId,
        planId: "business",
        status: "ACTIVE",
        provider: "none",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
      },
    });

    const primary = await prisma.establishment.create({
      data: {
        organizationId: orgId,
        legalName: `Principal ${stamp}`,
        tradeName: "Matriz",
        cnpj: cnpj1,
        uf: "SP",
        isPrimary: true,
        active: true,
        nfeSeries: 1,
        nfeLastNumber: 10,
        taxRegime: "SIMPLES_NACIONAL",
        nfeEnvironment: "HOMOLOGATION",
      },
    });
    primaryId = primary.id;

    await ensureDefaultOrderSituations(orgId);

    const admin = await prisma.user.create({
      data: {
        email: `admin-est-${stamp}@iso.test`,
        passwordHash,
        name: "Admin Est",
        role: "ADMIN",
        organizationId: orgId,
        activatedAt: new Date(),
      },
    });
    adminUserId = admin.id;
    adminToken = signAccessToken({
      sub: admin.id,
      role: "ADMIN",
      organizationId: orgId,
      sellerId: null,
      teamLeaderTeamId: null,
    });

    const manager = await prisma.user.create({
      data: {
        email: `mgr-est-${stamp}@iso.test`,
        passwordHash,
        name: "Gestor Est",
        role: "MANAGER",
        organizationId: orgId,
        activatedAt: new Date(),
        allowedEstablishmentIds: [],
      },
    });
    managerUserId = manager.id;
    managerToken = signAccessToken({
      sub: manager.id,
      role: "MANAGER",
      organizationId: orgId,
      sellerId: null,
      teamLeaderTeamId: null,
    });

    const sellerUser = await prisma.user.create({
      data: {
        email: `seller-est-${stamp}@iso.test`,
        passwordHash,
        name: "Vendedor Est",
        role: "SELLER",
        organizationId: orgId,
        activatedAt: new Date(),
        seller: {
          create: {
            organizationId: orgId,
            commissionType: "FIXED",
            commissionPercent: 5,
            active: true,
          },
        },
      },
      include: { seller: true },
    });
    sellerId = sellerUser.seller!.id;

    const customer = await prisma.customer.create({
      data: {
        name: `Cliente Est ${stamp}`,
        organizationId: orgId,
        approvalStatus: "APPROVED",
        status: "ACTIVE",
      },
    });
    customerId = customer.id;

    const product = await prisma.product.create({
      data: {
        name: `Produto Est ${stamp}`,
        organizationId: orgId,
        basePrice: 10,
        stockQty: 100,
      },
    });
    productId = product.id;
    await prisma.sellerProduct.create({
      data: { sellerId, productId },
    });

    const pay = await prisma.paymentCondition.create({
      data: {
        organizationId: orgId,
        code: `AVISTA-${stamp.slice(0, 6)}`,
        name: "À vista",
        days: 0,
        active: true,
      },
    });
    payId = pay.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.orderItem
      .deleteMany({ where: { order: { organizationId: orgId } } })
      .catch(() => {});
    await prisma.order.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  });

  it("migração/backfill: org tem estabelecimento principal com CNPJ", async () => {
    const primary = await getPrimaryEstablishment(orgId);
    expect(primary?.id).toBe(primaryId);
    expect(cnpjDigitsOnly(primary?.cnpj ?? "")).toBe(cnpj1);
    expect(primary?.isPrimary).toBe(true);
  });

  it("1 CNPJ: lista retorna só o principal", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/establishments",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: { id: string; cnpj: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.id).toBe(primaryId);
  });

  it("2 CNPJs: cria segundo estabelecimento (plano business)", async () => {
    const created = await createEstablishment(orgId, {
      legalName: `Filial ${stamp}`,
      tradeName: "Filial",
      cnpj: cnpj2,
      uf: "RJ",
      nfeSeries: 2,
    });
    secondaryId = created.id;
    expect(created.cnpj).toBe(cnpj2);
    expect(created.isPrimary).toBe(false);
    expect(created.nfeSeries).toBe(2);
    expect(created.nfeLastNumber).toBe(0);

    const count = await prisma.establishment.count({
      where: { organizationId: orgId },
    });
    expect(count).toBe(2);
  });

  it("estoque compartilhado: produto único por org (sem estoque por CNPJ)", async () => {
    const stocks = await prisma.product.findMany({
      where: { organizationId: orgId },
      select: { id: true, stockQty: true },
    });
    expect(stocks).toHaveLength(1);
    expect(Number(stocks[0]!.stockQty)).toBe(100);

    const productStocks = await prisma.productStock.findMany({
      where: { organizationId: orgId },
    });
    // ProductStock é opcional/1:1 por produto — nunca por establishment
    for (const ps of productStocks) {
      expect((ps as { establishmentId?: string }).establishmentId).toBeUndefined();
    }
  });

  it("pedido vinculado ao establishmentId ativo (não muda se header mudar depois)", async () => {
    const orderA = await createSaleOrder({
      organizationId: orgId,
      actorUserId: adminUserId,
      sellerId,
      customerId,
      paymentConditionId: payId,
      establishmentId: primaryId,
      items: [{ productId, quantity: 1 }],
      status: "DRAFT",
      source: "admin",
      actorRole: "ADMIN",
      allowedProductIds: new Set([productId]),
    });
    expect(orderA.establishmentId).toBe(primaryId);

    const orderB = await createSaleOrder({
      organizationId: orgId,
      actorUserId: adminUserId,
      sellerId,
      customerId,
      paymentConditionId: payId,
      establishmentId: secondaryId,
      items: [{ productId, quantity: 1 }],
      status: "DRAFT",
      source: "admin",
      actorRole: "ADMIN",
      allowedProductIds: new Set([productId]),
    });
    expect(orderB.establishmentId).toBe(secondaryId);

    const reloaded = await prisma.order.findUnique({
      where: { id: orderA.id },
      select: { establishmentId: true },
    });
    expect(reloaded?.establishmentId).toBe(primaryId);
  });

  it("NF-e: numeração e certificado são por estabelecimento", async () => {
    await prisma.establishment.update({
      where: { id: primaryId },
      data: {
        nfeLastNumber: 10,
        certificatePfxEncrypted: Buffer.from("fake-pfx-a"),
        certificatePasswordEncrypted: "enc-a",
        certificateCnpj: cnpj1,
      },
    });
    await prisma.establishment.update({
      where: { id: secondaryId },
      data: {
        nfeLastNumber: 0,
        certificatePfxEncrypted: Buffer.from("fake-pfx-b"),
        certificatePasswordEncrypted: "enc-b",
        certificateCnpj: cnpj2,
        nfeSeries: 2,
      },
    });

    const a = await prisma.establishment.findUniqueOrThrow({
      where: { id: primaryId },
    });
    const b = await prisma.establishment.findUniqueOrThrow({
      where: { id: secondaryId },
    });
    expect(a.nfeLastNumber).toBe(10);
    expect(b.nfeLastNumber).toBe(0);
    expect(a.nfeSeries).toBe(1);
    expect(b.nfeSeries).toBe(2);
    expect(Buffer.from(a.certificatePfxEncrypted!).toString()).toBe("fake-pfx-a");
    expect(Buffer.from(b.certificatePfxEncrypted!).toString()).toBe("fake-pfx-b");
    expect(a.certificateCnpj).toBe(cnpj1);
    expect(b.certificateCnpj).toBe(cnpj2);
  });

  it("permissão: manager com allowedEstablishmentIds vazio não acessa CNPJs", () => {
    expect(
      userCanAccessEstablishment({
        role: "MANAGER",
        allowedEstablishmentIds: [],
        establishmentId: primaryId,
      }),
    ).toBe(false);
    expect(
      userCanAccessEstablishment({
        role: "MANAGER",
        allowedEstablishmentIds: [primaryId],
        establishmentId: primaryId,
      }),
    ).toBe(true);
    expect(
      userCanAccessEstablishment({
        role: "MANAGER",
        allowedEstablishmentIds: [primaryId],
        establishmentId: secondaryId,
      }),
    ).toBe(false);
    expect(
      userCanAccessEstablishment({
        role: "ADMIN",
        allowedEstablishmentIds: [],
        establishmentId: secondaryId,
      }),
    ).toBe(true);
  });

  it("API: manager sem permissão de establishment recebe 403 ao preferir CNPJ", async () => {
    await prisma.user.update({
      where: { id: managerUserId },
      data: { allowedEstablishmentIds: [primaryId] },
    });
    const forbidden = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/establishments/preferred",
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { establishmentId: secondaryId },
    });
    expect(forbidden.statusCode).toBe(403);

    const ok = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/establishments/preferred",
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { establishmentId: primaryId },
    });
    expect(ok.statusCode).toBe(200);
  });

  it("API POST /admin/orders grava establishmentId do body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        sellerId,
        customerId,
        paymentConditionId: payId,
        establishmentId: secondaryId,
        status: "DRAFT",
        items: [{ productId, quantity: 1 }],
      },
    });
    expect(res.statusCode).toBe(200);
    const order = res.json() as { establishmentId: string };
    expect(order.establishmentId).toBe(secondaryId);
  });
});
