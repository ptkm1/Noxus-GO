-- CreateTable
CREATE TABLE "SalesTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaderSellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesTeam_leaderSellerId_key" ON "SalesTeam"("leaderSellerId");

-- CreateIndex
CREATE INDEX "SalesTeam_organizationId_idx" ON "SalesTeam"("organizationId");

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN "teamId" TEXT;

-- CreateIndex
CREATE INDEX "Seller_organizationId_teamId_idx" ON "Seller"("organizationId", "teamId");

-- AddForeignKey
ALTER TABLE "SalesTeam" ADD CONSTRAINT "SalesTeam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTeam" ADD CONSTRAINT "SalesTeam_leaderSellerId_fkey" FOREIGN KEY ("leaderSellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SalesTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
