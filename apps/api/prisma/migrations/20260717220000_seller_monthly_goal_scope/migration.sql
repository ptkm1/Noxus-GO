-- Escopo de metas: vendedor, equipe ou todos os vendedores.

CREATE TYPE "SellerMonthlyGoalScope" AS ENUM ('SELLER', 'TEAM', 'ALL');

ALTER TABLE "SellerMonthlyGoal" ADD COLUMN "scope" "SellerMonthlyGoalScope" NOT NULL DEFAULT 'SELLER';
ALTER TABLE "SellerMonthlyGoal" ADD COLUMN "scopeKey" TEXT;
ALTER TABLE "SellerMonthlyGoal" ADD COLUMN "teamId" TEXT;

-- Backfill: metas existentes são por vendedor.
UPDATE "SellerMonthlyGoal"
SET "scopeKey" = 'SELLER:' || "sellerId"
WHERE "scopeKey" IS NULL;

ALTER TABLE "SellerMonthlyGoal" ALTER COLUMN "scopeKey" SET NOT NULL;

ALTER TABLE "SellerMonthlyGoal" ALTER COLUMN "sellerId" DROP NOT NULL;

DROP INDEX IF EXISTS "SellerMonthlyGoal_organizationId_sellerId_year_month_key";

CREATE UNIQUE INDEX "SellerMonthlyGoal_organizationId_scopeKey_year_month_key"
  ON "SellerMonthlyGoal"("organizationId", "scopeKey", "year", "month");

CREATE INDEX "SellerMonthlyGoal_organizationId_year_month_idx"
  ON "SellerMonthlyGoal"("organizationId", "year", "month");

CREATE INDEX "SellerMonthlyGoal_organizationId_sellerId_idx"
  ON "SellerMonthlyGoal"("organizationId", "sellerId");

CREATE INDEX "SellerMonthlyGoal_organizationId_teamId_idx"
  ON "SellerMonthlyGoal"("organizationId", "teamId");

ALTER TABLE "SellerMonthlyGoal"
  ADD CONSTRAINT "SellerMonthlyGoal_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "SalesTeam"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
