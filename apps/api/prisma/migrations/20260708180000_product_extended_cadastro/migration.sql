-- CreateEnum
CREATE TYPE "ProductClassification" AS ENUM ('RESALE', 'RAW_MATERIAL', 'INTERNAL_USE', 'SERVICE', 'OTHER');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "productLine" TEXT,
ADD COLUMN "productClassification" "ProductClassification",
ADD COLUMN "purchaseUnit" TEXT,
ADD COLUMN "standardPurchaseBoxQty" INTEGER,
ADD COLUMN "grossWeightKg" DECIMAL(10,3),
ADD COLUMN "netWeightKg" DECIMAL(10,3),
ADD COLUMN "stockAddress" TEXT,
ADD COLUMN "minStockQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxStockQty" INTEGER,
ADD COLUMN "costPrice" DECIMAL(12,2),
ADD COLUMN "factoryPrice" DECIMAL(12,2),
ADD COLUMN "maxSalePrice" DECIMAL(12,2),
ADD COLUMN "freightAmount" DECIMAL(12,2),
ADD COLUMN "collectionCommissionPercent" DECIMAL(5,2),
ADD COLUMN "maxDailyQtyPerSeller" INTEGER,
ADD COLUMN "maxDailyQtyPerCustomer" INTEGER,
ADD COLUMN "ncm" TEXT,
ADD COLUMN "ncmException" TEXT,
ADD COLUMN "nfeOrigin" INTEGER,
ADD COLUMN "fiscalClass" TEXT,
ADD COLUMN "pisCofinsClassification" TEXT,
ADD COLUMN "cstPis" TEXT,
ADD COLUMN "ipiPercent" DECIMAL(5,2),
ADD COLUMN "icmsCostPercent" DECIMAL(5,2),
ADD COLUMN "cbsIbsClassification" TEXT;

-- CreateIndex
CREATE INDEX "Product_organizationId_ncm_idx" ON "Product"("organizationId", "ncm");
