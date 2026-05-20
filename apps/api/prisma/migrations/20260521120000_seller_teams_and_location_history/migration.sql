-- AlterTable
ALTER TABLE "Seller" ADD COLUMN "managerUserId" TEXT;

-- CreateIndex
CREATE INDEX "Seller_organizationId_managerUserId_idx" ON "Seller"("organizationId", "managerUserId");

-- AddForeignKey
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SellerLocationHistory" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "accuracyMeters" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerLocationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerLocationHistory_sellerId_recordedAt_idx" ON "SellerLocationHistory"("sellerId", "recordedAt");

-- CreateIndex
CREATE INDEX "SellerLocationHistory_organizationId_recordedAt_idx" ON "SellerLocationHistory"("organizationId", "recordedAt");

-- AddForeignKey
ALTER TABLE "SellerLocationHistory" ADD CONSTRAINT "SellerLocationHistory_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerLocationHistory" ADD CONSTRAINT "SellerLocationHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
