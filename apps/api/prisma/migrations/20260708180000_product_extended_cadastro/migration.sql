-- Product: campos estendidos de cadastro (idempotente para DBs parcialmente atualizadas).



DO $$ BEGIN

  CREATE TYPE "ProductClassification" AS ENUM ('RESALE', 'RAW_MATERIAL', 'INTERNAL_USE', 'SERVICE', 'OTHER');

EXCEPTION

  WHEN duplicate_object THEN NULL;

END $$;



ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productLine" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productClassification" "ProductClassification";

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "purchaseUnit" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "standardPurchaseBoxQty" INTEGER;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "grossWeightKg" DECIMAL(10,3);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "netWeightKg" DECIMAL(10,3);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockAddress" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minStockQty" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "maxStockQty" INTEGER;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(12,2);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "factoryPrice" DECIMAL(12,2);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "maxSalePrice" DECIMAL(12,2);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "freightAmount" DECIMAL(12,2);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "collectionCommissionPercent" DECIMAL(5,2);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "maxDailyQtyPerSeller" INTEGER;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "maxDailyQtyPerCustomer" INTEGER;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ncm" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ncmException" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "nfeOrigin" INTEGER;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fiscalClass" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pisCofinsClassification" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cstPis" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ipiPercent" DECIMAL(5,2);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "icmsCostPercent" DECIMAL(5,2);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cbsIbsClassification" TEXT;



CREATE INDEX IF NOT EXISTS "Product_organizationId_ncm_idx" ON "Product"("organizationId", "ncm");
