-- Última posição GPS de cada vendedor (rastreio em tempo real no painel admin).
CREATE TABLE "SellerLiveLocation" (
    "sellerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "latitude" DECIMAL(10, 8) NOT NULL,
    "longitude" DECIMAL(11, 8) NOT NULL,
    "accuracyMeters" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerLiveLocation_pkey" PRIMARY KEY ("sellerId")
);

CREATE INDEX "SellerLiveLocation_organizationId_recordedAt_idx" ON "SellerLiveLocation"("organizationId", "recordedAt");

ALTER TABLE "SellerLiveLocation" ADD CONSTRAINT "SellerLiveLocation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellerLiveLocation" ADD CONSTRAINT "SellerLiveLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
