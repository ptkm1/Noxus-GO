-- CreateEnum
CREATE TYPE "SellerCommissionType" AS ENUM ('FIXED', 'BY_PRODUCT', 'BY_CATEGORY', 'BY_SUPPLIER');

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN "commissionType" "SellerCommissionType" NOT NULL DEFAULT 'FIXED';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "commissionPercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "product_categories" ADD COLUMN "commissionPercent" DECIMAL(5,2);
