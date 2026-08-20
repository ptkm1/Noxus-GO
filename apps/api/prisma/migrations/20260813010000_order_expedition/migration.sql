-- CreateEnum
CREATE TYPE "OrderExpeditionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OrderExpeditionEventType" AS ENUM ('START', 'SCAN', 'MANUAL_INC', 'MANUAL_DEC', 'COMPLETE', 'LABEL_PRINT', 'REJECT_UNKNOWN', 'REJECT_WRONG', 'REJECT_OVER');

-- CreateTable
CREATE TABLE "OrderExpedition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderExpeditionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedByUserId" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "finishedByUserId" TEXT,
    "volumeQty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderExpedition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExpeditionItem" (
    "id" TEXT NOT NULL,
    "expeditionId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "checkedQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderExpeditionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExpeditionEvent" (
    "id" TEXT NOT NULL,
    "expeditionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "OrderExpeditionEventType" NOT NULL,
    "orderItemId" TEXT,
    "productId" TEXT,
    "barcode" TEXT,
    "qtyDelta" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderExpeditionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderExpedition_orderId_key" ON "OrderExpedition"("orderId");

-- CreateIndex
CREATE INDEX "OrderExpedition_organizationId_status_idx" ON "OrderExpedition"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OrderExpedition_organizationId_startedAt_idx" ON "OrderExpedition"("organizationId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderExpeditionItem_expeditionId_orderItemId_key" ON "OrderExpeditionItem"("expeditionId", "orderItemId");

-- CreateIndex
CREATE INDEX "OrderExpeditionItem_expeditionId_idx" ON "OrderExpeditionItem"("expeditionId");

-- CreateIndex
CREATE INDEX "OrderExpeditionEvent_expeditionId_createdAt_idx" ON "OrderExpeditionEvent"("expeditionId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderExpedition" ADD CONSTRAINT "OrderExpedition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExpedition" ADD CONSTRAINT "OrderExpedition_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExpedition" ADD CONSTRAINT "OrderExpedition_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExpedition" ADD CONSTRAINT "OrderExpedition_finishedByUserId_fkey" FOREIGN KEY ("finishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExpeditionItem" ADD CONSTRAINT "OrderExpeditionItem_expeditionId_fkey" FOREIGN KEY ("expeditionId") REFERENCES "OrderExpedition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExpeditionItem" ADD CONSTRAINT "OrderExpeditionItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExpeditionEvent" ADD CONSTRAINT "OrderExpeditionEvent_expeditionId_fkey" FOREIGN KEY ("expeditionId") REFERENCES "OrderExpedition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExpeditionEvent" ADD CONSTRAINT "OrderExpeditionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
