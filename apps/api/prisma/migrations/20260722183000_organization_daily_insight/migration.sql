-- CreateTable
CREATE TABLE "OrganizationDailyInsight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tips" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationDailyInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationDailyInsight_organizationId_date_idx" ON "OrganizationDailyInsight"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationDailyInsight_organizationId_date_key" ON "OrganizationDailyInsight"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "OrganizationDailyInsight" ADD CONSTRAINT "OrganizationDailyInsight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
