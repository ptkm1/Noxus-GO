-- DropIndex
DROP INDEX "StockMovement_organizationId_productId_idx";

-- AlterTable
ALTER TABLE "FiscalInvoice" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FiscalNcm" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FiscalOperation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrganizationFiscalConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductStock" ALTER COLUMN "updatedAt" DROP DEFAULT;
