-- Comissão progressiva + metas mensais para ranking/dashboard.

CREATE TABLE "CommissionProgressiveTier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sellerId" TEXT,
    "thresholdAmount" DECIMAL(14,2) NOT NULL,
    "commissionPercent" DECIMAL(5,2) NOT NULL,
    "label" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionProgressiveTier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommissionProgressiveTier_organizationId_sellerId_idx" ON "CommissionProgressiveTier"("organizationId", "sellerId");

ALTER TABLE "CommissionProgressiveTier" ADD CONSTRAINT "CommissionProgressiveTier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommissionProgressiveTier" ADD CONSTRAINT "CommissionProgressiveTier_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SellerMonthlyGoal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Meta do mês',
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerMonthlyGoal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerMonthlyGoal_organizationId_sellerId_year_month_key" ON "SellerMonthlyGoal"("organizationId", "sellerId", "year", "month");

ALTER TABLE "SellerMonthlyGoal" ADD CONSTRAINT "SellerMonthlyGoal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellerMonthlyGoal" ADD CONSTRAINT "SellerMonthlyGoal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
