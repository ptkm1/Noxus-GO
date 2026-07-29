-- CreateTable
CREATE TABLE "OrderSituation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "mapsToCancel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderSituation_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "situationId" TEXT;

-- CreateIndex
CREATE INDEX "OrderSituation_organizationId_active_sortOrder_idx" ON "OrderSituation"("organizationId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OrderSituation_organizationId_code_key" ON "OrderSituation"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Order_organizationId_situationId_idx" ON "Order"("organizationId", "situationId");

-- AddForeignKey
ALTER TABLE "OrderSituation" ADD CONSTRAINT "OrderSituation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "OrderSituation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
