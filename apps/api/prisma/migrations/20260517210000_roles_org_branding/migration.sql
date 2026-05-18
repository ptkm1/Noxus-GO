-- Papéis SUPERVISOR e MANAGER; campos opcionais de marca (whitelabel) na Organization.

ALTER TYPE "Role" ADD VALUE 'SUPERVISOR';
ALTER TYPE "Role" ADD VALUE 'MANAGER';

ALTER TABLE "Organization" ADD COLUMN "displayName" TEXT,
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "primaryColor" TEXT,
ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
