-- CreateTable
CREATE TABLE "OrganizationProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "baseRole" "Role" NOT NULL DEFAULT 'MANAGER',
    "hasSellerProfile" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationProfilePermission" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL,

    CONSTRAINT "OrganizationProfilePermission_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "organizationProfileId" TEXT;

-- CreateIndex
CREATE INDEX "OrganizationProfile_organizationId_enabled_idx" ON "OrganizationProfile"("organizationId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationProfile_organizationId_key_key" ON "OrganizationProfile"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationProfilePermission_profileId_resource_key" ON "OrganizationProfilePermission"("profileId", "resource");

-- CreateIndex
CREATE INDEX "User_organizationProfileId_idx" ON "User"("organizationProfileId");

-- AddForeignKey
ALTER TABLE "OrganizationProfile" ADD CONSTRAINT "OrganizationProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProfilePermission" ADD CONSTRAINT "OrganizationProfilePermission_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "OrganizationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationProfileId_fkey" FOREIGN KEY ("organizationProfileId") REFERENCES "OrganizationProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
