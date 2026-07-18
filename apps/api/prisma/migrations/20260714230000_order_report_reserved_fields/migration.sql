-- AlterTable
ALTER TABLE "Order" ADD COLUMN "orderNumber" INTEGER;
ALTER TABLE "Order" ADD COLUMN "isQuote" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "representada" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_organizationId_orderNumber_key" ON "Order"("organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX "Order_organizationId_createdAt_idx" ON "Order"("organizationId", "createdAt");
