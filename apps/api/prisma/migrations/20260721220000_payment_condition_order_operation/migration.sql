-- CreateEnum
CREATE TYPE "OrderOperation" AS ENUM ('SALE');

-- CreateTable
CREATE TABLE "PaymentCondition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCondition_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentConditionId" TEXT,
ADD COLUMN "operation" "OrderOperation" NOT NULL DEFAULT 'SALE';

-- CreateIndex
CREATE INDEX "PaymentCondition_organizationId_active_sortOrder_idx" ON "PaymentCondition"("organizationId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCondition_organizationId_code_key" ON "PaymentCondition"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Order_organizationId_paymentConditionId_idx" ON "Order"("organizationId", "paymentConditionId");

-- AddForeignKey
ALTER TABLE "PaymentCondition" ADD CONSTRAINT "PaymentCondition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentConditionId_fkey" FOREIGN KEY ("paymentConditionId") REFERENCES "PaymentCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
