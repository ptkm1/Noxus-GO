-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('none', 'read', 'write');

-- CreateTable
CREATE TABLE "OrganizationRolePermission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "resource" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationRolePermission_organizationId_idx" ON "OrganizationRolePermission"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRolePermission_organizationId_role_resource_key" ON "OrganizationRolePermission"("organizationId", "role", "resource");

-- AddForeignKey
ALTER TABLE "OrganizationRolePermission" ADD CONSTRAINT "OrganizationRolePermission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed defaults for existing organizations (mirror static ROLE_PERMISSIONS).
INSERT INTO "OrganizationRolePermission" ("id", "organizationId", "role", "resource", "level", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || o.id || r.role || r.resource)::text,
  o.id,
  r.role::"Role",
  r.resource,
  r.level::"AccessLevel",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (
  VALUES
    ('ADMIN', 'dashboard', 'read'),
    ('MANAGER', 'dashboard', 'read'),
    ('SELLER', 'dashboard', 'none'),
    ('SUPERVISOR', 'dashboard', 'none'),
    ('ADMIN', 'products', 'write'),
    ('MANAGER', 'products', 'none'),
    ('SELLER', 'products', 'read'),
    ('SUPERVISOR', 'products', 'none'),
    ('ADMIN', 'stock', 'write'),
    ('MANAGER', 'stock', 'none'),
    ('SELLER', 'stock', 'none'),
    ('SUPERVISOR', 'stock', 'none'),
    ('ADMIN', 'suppliers', 'write'),
    ('MANAGER', 'suppliers', 'none'),
    ('SELLER', 'suppliers', 'none'),
    ('SUPERVISOR', 'suppliers', 'none'),
    ('ADMIN', 'fiscal', 'write'),
    ('MANAGER', 'fiscal', 'none'),
    ('SELLER', 'fiscal', 'none'),
    ('SUPERVISOR', 'fiscal', 'none'),
    ('ADMIN', 'customers', 'write'),
    ('MANAGER', 'customers', 'none'),
    ('SELLER', 'customers', 'write'),
    ('SUPERVISOR', 'customers', 'none'),
    ('ADMIN', 'orders', 'write'),
    ('MANAGER', 'orders', 'read'),
    ('SELLER', 'orders', 'write'),
    ('SUPERVISOR', 'orders', 'none'),
    ('ADMIN', 'sellers', 'write'),
    ('MANAGER', 'sellers', 'read'),
    ('SELLER', 'sellers', 'none'),
    ('SUPERVISOR', 'sellers', 'none'),
    ('ADMIN', 'teams', 'write'),
    ('MANAGER', 'teams', 'none'),
    ('SELLER', 'teams', 'none'),
    ('SUPERVISOR', 'teams', 'none'),
    ('ADMIN', 'users', 'write'),
    ('MANAGER', 'users', 'none'),
    ('SELLER', 'users', 'none'),
    ('SUPERVISOR', 'users', 'none'),
    ('ADMIN', 'tracking', 'read'),
    ('MANAGER', 'tracking', 'read'),
    ('SELLER', 'tracking', 'none'),
    ('SUPERVISOR', 'tracking', 'none'),
    ('ADMIN', 'visits', 'read'),
    ('MANAGER', 'visits', 'read'),
    ('SELLER', 'visits', 'write'),
    ('SUPERVISOR', 'visits', 'none'),
    ('ADMIN', 'reports', 'read'),
    ('MANAGER', 'reports', 'read'),
    ('SELLER', 'reports', 'none'),
    ('SUPERVISOR', 'reports', 'none'),
    ('ADMIN', 'commissions', 'write'),
    ('MANAGER', 'commissions', 'none'),
    ('SELLER', 'commissions', 'none'),
    ('SUPERVISOR', 'commissions', 'none'),
    ('ADMIN', 'price_tables', 'write'),
    ('MANAGER', 'price_tables', 'none'),
    ('SELLER', 'price_tables', 'none'),
    ('SUPERVISOR', 'price_tables', 'none'),
    ('ADMIN', 'permissions', 'read'),
    ('MANAGER', 'permissions', 'none'),
    ('SELLER', 'permissions', 'none'),
    ('SUPERVISOR', 'permissions', 'none'),
    ('ADMIN', 'audit', 'read'),
    ('MANAGER', 'audit', 'none'),
    ('SELLER', 'audit', 'none'),
    ('SUPERVISOR', 'audit', 'none')
) AS r(role, resource, level)
ON CONFLICT ("organizationId", "role", "resource") DO NOTHING;
