-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "latitude" DECIMAL(10, 8),
ADD COLUMN "longitude" DECIMAL(11, 8),
ADD COLUMN "addressNote" TEXT;

-- CreateTable
CREATE TABLE "SellerCustomerVisit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" TIMESTAMP(3),
    "checkInLat" DECIMAL(10, 8),
    "checkInLng" DECIMAL(11, 8),
    "checkOutLat" DECIMAL(10, 8),
    "checkOutLng" DECIMAL(11, 8),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerCustomerVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerCustomerVisit_sellerId_checkedInAt_idx" ON "SellerCustomerVisit"("sellerId", "checkedInAt");

-- CreateIndex
CREATE INDEX "SellerCustomerVisit_organizationId_checkedInAt_idx" ON "SellerCustomerVisit"("organizationId", "checkedInAt");

-- AddForeignKey
ALTER TABLE "SellerCustomerVisit" ADD CONSTRAINT "SellerCustomerVisit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerCustomerVisit" ADD CONSTRAINT "SellerCustomerVisit_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerCustomerVisit" ADD CONSTRAINT "SellerCustomerVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
