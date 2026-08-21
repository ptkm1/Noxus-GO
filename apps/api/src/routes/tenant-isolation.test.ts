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
});
