-- Flexible pricing: regiões, tabelas contextualizadas, promo por quantidade, combos, comissão variável, limites.

-- CreateEnum
CREATE TYPE "ProductComboDiscountKind" AS ENUM ('FIXED_PER_COMPLETE_SET', 'PERCENT_OF_SET_SUBTOTAL');

-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN "defaultMaxSellerDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 50;

-- CreateTable Region
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Region_organizationId_code_key" ON "Region"("organizationId", "code");

ALTER TABLE "Region" ADD CONSTRAINT "Region_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Customer
ALTER TABLE "Customer" ADD COLUMN "regionId" TEXT;

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable PriceTable
ALTER TABLE "PriceTable" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "customerId" TEXT,
ADD COLUMN "sellerId" TEXT,
ADD COLUMN "regionId" TEXT;

ALTER TABLE "PriceTable" ADD CONSTRAINT "PriceTable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PriceTable" ADD CONSTRAINT "PriceTable_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PriceTable" ADD CONSTRAINT "PriceTable_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "maxSellerDiscountPercent" DECIMAL(5,2),
ADD COLUMN "minSaleUnitPrice" DECIMAL(12,2);

-- AlterTable ProductPromotion
ALTER TABLE "product_promotions" ADD COLUMN "minQuantity" INTEGER;

-- CreateTable ProductCombo
CREATE TABLE "ProductCombo" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "kind" "ProductComboDiscountKind" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCombo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductCombo_organizationId_idx" ON "ProductCombo"("organizationId");

ALTER TABLE "ProductCombo" ADD CONSTRAINT "ProductCombo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ProductComboLine
CREATE TABLE "ProductComboLine" (
    "id" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ProductComboLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductComboLine_comboId_productId_key" ON "ProductComboLine"("comboId", "productId");

ALTER TABLE "ProductComboLine" ADD CONSTRAINT "ProductComboLine_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "ProductCombo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductComboLine" ADD CONSTRAINT "ProductComboLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable SellerCommissionRule
CREATE TABLE "SellerCommissionRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    "commissionPercent" DECIMAL(5,2) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerCommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SellerCommissionRule_organizationId_sellerId_idx" ON "SellerCommissionRule"("organizationId", "sellerId");

ALTER TABLE "SellerCommissionRule" ADD CONSTRAINT "SellerCommissionRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellerCommissionRule" ADD CONSTRAINT "SellerCommissionRule_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellerCommissionRule" ADD CONSTRAINT "SellerCommissionRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellerCommissionRule" ADD CONSTRAINT "SellerCommissionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "comboDiscountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable OrderItem
ALTER TABLE "OrderItem" ADD COLUMN "commissionPercent" DECIMAL(5,2),
ADD COLUMN "commissionAmount" DECIMAL(14,2);
