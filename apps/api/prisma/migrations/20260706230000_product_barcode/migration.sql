-- AlterTable
ALTER TABLE "Product" ADD COLUMN "barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_barcode_key" ON "Product"("organizationId", "barcode");
