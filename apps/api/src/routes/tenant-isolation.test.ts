import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db.js";
import { signAccessToken } from "../auth/jwt.js";
import { hashPassword } from "../auth/password.js";
import { buildApp } from "../app.js";

const hasDb = Boolean(process.env.DATABASE_URL?.trim() && process.env.JWT_SECRET?.trim());

type Tenant = {
  orgId: string;
  adminId: string;
  managerId: string;
  sellerId: string;
  sellerUserId: string;
  customerId: string;
  token: string;
};

describe.skipIf(!hasDb)("isolamento multi-tenant", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let tenantA: Tenant;
  let tenantB: Tenant;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function createTenant(label: string): Promise<Tenant> {
    const passwordHash = await hashPassword("iso-test-pass");
    const org = await prisma.organization.create({
      data: {
        name: `Iso ${label} ${stamp}`,
        displayName: `Iso ${label} ${stamp}`,
        accessStatus: "ACTIVE",
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: `admin-${label}-${stamp}@iso.test`,
        passwordHash,
        name: `Admin ${label}`,
        role: "ADMIN",
        organizationId: org.id,
        activatedAt: new Date(),
      },
    });
    const manager = await prisma.user.create({
      data: {
        email: `manager-${label}-${stamp}@iso.test`,
        passwordHash,
        name: `Gestor ${label}`,
        role: "MANAGER",
        organizationId: org.id,
        activatedAt: new Date(),
      },
    });
    const sellerUser = await prisma.user.create({
      data: {
        email: `seller-${label}-${stamp}@iso.test`,
        passwordHash,
        name: `Vendedor ${label}`,
        role: "SELLER",
        organizationId: org.id,
        activatedAt: new Date(),
        seller: {
          create: {
            organizationId: org.id,
            commissionType: "FIXED",
            commissionPercent: 10,
            active: true,
          },
        },
      },
      include: { seller: true },
    });
    const customer = await prisma.customer.create({
      data: {
        name: `Cliente ${label} ${stamp}`,
        organizationId: org.id,
      },
    });
    return {
      orgId: org.id,
      adminId: admin.id,
      managerId: manager.id,
      sellerId: sellerUser.seller!.id,
      sellerUserId: sellerUser.id,
      customerId: customer.id,
      token: signAccessToken({
        sub: admin.id,
        role: "ADMIN",
        organizationId: org.id,
        sellerId: null,
      }),
    };
  }

  async function adminGet(token: string, path: string) {
    return app.inject({
      method: "GET",
      url: `/api/v1/admin${path}`,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  beforeAll(async () => {
    app = await buildApp();
    tenantA = await createTenant("A");
    tenantB = await createTenant("B");
  }, 60_000);

  afterAll(async () => {
    const ids = [tenantA?.orgId, tenantB?.orgId].filter(Boolean);
    if (ids.length) {
      await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
  });

  it("GET /users não lista staff de outra empresa", async () => {
    const resA = await adminGet(tenantA.token, "/users");
    const resB = await adminGet(tenantB.token, "/users");
    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);
    const usersA = JSON.parse(resA.body) as Array<{ id: string }>;
    const usersB = JSON.parse(resB.body) as Array<{ id: string }>;
    const idsA = usersA.map((u) => u.id);
    const idsB = usersB.map((u) => u.id);

    expect(idsA).toEqual(
      expect.arrayContaining([tenantA.adminId, tenantA.managerId]),
    );
    expect(idsA).not.toContain(tenantA.sellerUserId);
    expect(idsA).not.toContain(tenantB.adminId);
    expect(idsA).not.toContain(tenantB.managerId);

    expect(idsB).toEqual(
      expect.arrayContaining([tenantB.adminId, tenantB.managerId]),
    );
    expect(idsB).not.toContain(tenantA.adminId);
  });

  it("GET /sellers e GET /customers não vazam entre empresas", async () => {
    const sellersResA = await adminGet(tenantA.token, "/sellers");
    const sellersResB = await adminGet(tenantB.token, "/sellers");
    expect(sellersResA.statusCode).toBe(200);
    expect(sellersResB.statusCode).toBe(200);
    const sellersA = JSON.parse(sellersResA.body) as Array<{ id: string }>;
    const sellersB = JSON.parse(sellersResB.body) as Array<{ id: string }>;
    expect(sellersA.map((s) => s.id)).toContain(tenantA.sellerId);
    expect(sellersA.map((s) => s.id)).not.toContain(tenantB.sellerId);
    expect(sellersB.map((s) => s.id)).toContain(tenantB.sellerId);
    expect(sellersB.map((s) => s.id)).not.toContain(tenantA.sellerId);

    const customersResA = await adminGet(tenantA.token, "/customers");
    const customersResB = await adminGet(tenantB.token, "/customers");
    expect(customersResA.statusCode).toBe(200);
    expect(customersResB.statusCode).toBe(200);
    const customersA = JSON.parse(customersResA.body) as Array<{ id: string }>;
    const customersB = JSON.parse(customersResB.body) as Array<{ id: string }>;
    expect(customersA.map((c) => c.id)).toContain(tenantA.customerId);
    expect(customersA.map((c) => c.id)).not.toContain(tenantB.customerId);
    expect(customersB.map((c) => c.id)).toContain(tenantB.customerId);
    expect(customersB.map((c) => c.id)).not.toContain(tenantA.customerId);
  });

  it("PATCH/DELETE de usuário de outra empresa retorna 404", async () => {
    const patch = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/users/${tenantB.managerId}`,
      headers: {
        authorization: `Bearer ${tenantA.token}`,
        "content-type": "application/json",
      },
      payload: { name: "Não deveria alterar" },
    });
    expect(patch.statusCode).toBe(404);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/users/${tenantB.managerId}`,
      headers: { authorization: `Bearer ${tenantA.token}` },
    });
    expect(del.statusCode).toBe(404);

    const still = await prisma.user.findUnique({
      where: { id: tenantB.managerId },
      select: { name: true },
    });
    expect(still?.name).toBe("Gestor B");
  });

  it("PATCH/DELETE de vendedor de outra empresa retorna 404", async () => {
    const patch = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/sellers/${tenantB.sellerId}`,
      headers: {
        authorization: `Bearer ${tenantA.token}`,
        "content-type": "application/json",
      },
      payload: { name: "Não deveria alterar" },
    });
    expect(patch.statusCode).toBe(404);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/sellers/${tenantB.sellerId}`,
      headers: { authorization: `Bearer ${tenantA.token}` },
    });
    expect(del.statusCode).toBe(404);

    const still = await prisma.seller.findUnique({
      where: { id: tenantB.sellerId },
      select: { id: true },
    });
    expect(still?.id).toBe(tenantB.sellerId);
  });

  it("GET produtos, catálogo de pedido e cadastros não vazam entre empresas", async () => {
    const categoryA = await prisma.productCategory.create({
      data: {
        organizationId: tenantA.orgId,
        code: "1",
        name: `Grupo A ${stamp}`,
      },
    });
    const categoryB = await prisma.productCategory.create({
      data: {
        organizationId: tenantB.orgId,
        code: "1",
        name: `Grupo B ${stamp}`,
      },
    });
    const tableA = await prisma.priceTable.create({
      data: { organizationId: tenantA.orgId, name: `Tabela A ${stamp}` },
    });
    const tableB = await prisma.priceTable.create({
      data: { organizationId: tenantB.orgId, name: `Tabela B ${stamp}` },
    });
    await prisma.purchaseUnit.create({
      data: {
        organizationId: tenantA.orgId,
        code: `ISOA${stamp.slice(0, 6).toUpperCase()}`,
        name: "Unidade só da A",
        sortOrder: 50,
        isSystem: false,
      },
    });
    const productA = await prisma.product.create({
      data: {
        name: `PIMENTINHA SALTBITS A ${stamp}`,
        sku: "001",
        barcode: `789${stamp.replace(/\D/g, "").padEnd(10, "0").slice(0, 10)}`,
        organizationId: tenantA.orgId,
        categoryId: categoryA.id,
        basePrice: 56,
      },
    });
    const productB = await prisma.product.create({
      data: {
        name: `Produto B ${stamp}`,
        sku: "B-001",
        organizationId: tenantB.orgId,
        categoryId: categoryB.id,
        basePrice: 10,
      },
    });
    await prisma.sellerProduct.createMany({
      data: [
        { sellerId: tenantA.sellerId, productId: productA.id },
        { sellerId: tenantB.sellerId, productId: productB.id },
        { sellerId: tenantB.sellerId, productId: productA.id },
      ],
    });

    const productsResA = await adminGet(tenantA.token, "/products");
    const productsResB = await adminGet(tenantB.token, "/products");
    expect(productsResA.statusCode).toBe(200);
    expect(productsResB.statusCode).toBe(200);
    const productsA = JSON.parse(productsResA.body) as Array<{ id: string }>;
    const productsB = JSON.parse(productsResB.body) as Array<{ id: string }>;
    expect(productsA.map((p) => p.id)).toContain(productA.id);
    expect(productsA.map((p) => p.id)).not.toContain(productB.id);
    expect(productsB.map((p) => p.id)).toContain(productB.id);
    expect(productsB.map((p) => p.id)).not.toContain(productA.id);

    const catalogResA = await adminGet(
      tenantA.token,
      `/orders/catalog?sellerId=${tenantA.sellerId}`,
    );
    const catalogResB = await adminGet(
      tenantB.token,
      `/orders/catalog?sellerId=${tenantB.sellerId}`,
    );
    expect(catalogResA.statusCode).toBe(200);
    expect(catalogResB.statusCode).toBe(200);
    const catalogA = JSON.parse(catalogResA.body) as {
      products: Array<{ id: string }>;
    };
    const catalogB = JSON.parse(catalogResB.body) as {
      products: Array<{ id: string }>;
    };
    expect(catalogA.products.map((p) => p.id)).toContain(productA.id);
    expect(catalogA.products.map((p) => p.id)).not.toContain(productB.id);
    expect(catalogB.products.map((p) => p.id)).toContain(productB.id);
    expect(catalogB.products.map((p) => p.id)).not.toContain(productA.id);

    const stolenSeller = await adminGet(
      tenantB.token,
      `/orders/catalog?sellerId=${tenantA.sellerId}`,
    );
    expect(stolenSeller.statusCode).toBe(400);

    const assignedB = await adminGet(
      tenantB.token,
      `/sellers/${tenantB.sellerId}/products`,
    );
    expect(assignedB.statusCode).toBe(200);
    const assignedIds = (
      JSON.parse(assignedB.body) as Array<{ id: string }>
    ).map((p) => p.id);
    expect(assignedIds).toContain(productB.id);
    expect(assignedIds).not.toContain(productA.id);

    const catsA = JSON.parse(
      (await adminGet(tenantA.token, "/product-categories")).body,
    ) as Array<{ id: string }>;
    const catsB = JSON.parse(
      (await adminGet(tenantB.token, "/product-categories")).body,
    ) as Array<{ id: string }>;
    expect(catsA.map((c) => c.id)).toContain(categoryA.id);
    expect(catsA.map((c) => c.id)).not.toContain(categoryB.id);
    expect(catsB.map((c) => c.id)).toContain(categoryB.id);
    expect(catsB.map((c) => c.id)).not.toContain(categoryA.id);

    const tablesA = JSON.parse(
      (await adminGet(tenantA.token, "/price-tables")).body,
    ) as Array<{ id: string }>;
    const tablesB = JSON.parse(
      (await adminGet(tenantB.token, "/price-tables")).body,
    ) as Array<{ id: string }>;
    expect(tablesA.map((t) => t.id)).toContain(tableA.id);
    expect(tablesA.map((t) => t.id)).not.toContain(tableB.id);
    expect(tablesB.map((t) => t.id)).toContain(tableB.id);
    expect(tablesB.map((t) => t.id)).not.toContain(tableA.id);

    const unitsB = JSON.parse(
      (await adminGet(tenantB.token, "/purchase-units")).body,
    ) as Array<{ code: string }>;
    expect(unitsB.map((u) => u.code)).not.toContain(
      `ISOA${stamp.slice(0, 6).toUpperCase()}`,
    );

    const extraA = await prisma.product.create({
      data: {
        name: `Novo A ${stamp}`,
        organizationId: tenantA.orgId,
        basePrice: 3,
      },
    });
    const afterB = JSON.parse(
      (await adminGet(tenantB.token, "/products")).body,
    ) as Array<{ id: string }>;
    expect(afterB.map((p) => p.id)).not.toContain(extraA.id);

    const emptyOrg = await prisma.organization.create({
      data: {
        name: `Iso Empty ${stamp}`,
        displayName: `Iso Empty ${stamp}`,
        accessStatus: "ACTIVE",
      },
    });
    const emptyAdmin = await prisma.user.create({
      data: {
        email: `admin-empty-${stamp}@iso.test`,
        passwordHash: await hashPassword("iso-test-pass"),
        name: "Admin Empty",
        role: "ADMIN",
        organizationId: emptyOrg.id,
        activatedAt: new Date(),
      },
    });
    const emptySellerUser = await prisma.user.create({
      data: {
        email: `seller-empty-${stamp}@iso.test`,
        passwordHash: await hashPassword("iso-test-pass"),
        name: "Seller Empty",
        role: "SELLER",
        organizationId: emptyOrg.id,
        activatedAt: new Date(),
        seller: {
          create: {
            organizationId: emptyOrg.id,
            commissionType: "FIXED",
            commissionPercent: 10,
            active: true,
          },
        },
      },
      include: { seller: true },
    });
    await prisma.sellerProduct.create({
      data: {
        sellerId: emptySellerUser.seller!.id,
        productId: productA.id,
      },
    });
    const emptyToken = signAccessToken({
      sub: emptyAdmin.id,
      role: "ADMIN",
      organizationId: emptyOrg.id,
      sellerId: null,
    });
    const emptyCatalog = await adminGet(
      emptyToken,
      `/orders/catalog?sellerId=${emptySellerUser.seller!.id}`,
    );
    expect(emptyCatalog.statusCode).toBe(200);
    const emptyProducts = (
      JSON.parse(emptyCatalog.body) as { products: Array<{ id: string }> }
    ).products;
    expect(emptyProducts.map((p) => p.id)).not.toContain(productA.id);
    expect(emptyProducts).toHaveLength(0);

    await prisma.organization.delete({ where: { id: emptyOrg.id } });
  });
});

