-- CreateTable
CREATE TABLE "StockExpiryAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "thresholdDays" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockExpiryAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockExpiryAlert_organizationId_notifiedAt_idx" ON "StockExpiryAlert"("organizationId", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockExpiryAlert_lotId_thresholdDays_key" ON "StockExpiryAlert"("lotId", "thresholdDays");

-- AddForeignKey
ALTER TABLE "StockExpiryAlert" ADD CONSTRAINT "StockExpiryAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockExpiryAlert" ADD CONSTRAINT "StockExpiryAlert_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "ProductLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
