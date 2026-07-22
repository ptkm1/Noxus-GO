-- CreateEnum
CREATE TYPE "CustomerRegistrationMode" AS ENUM ('AUTO', 'REQUIRE_APPROVAL');

-- CreateEnum
CREATE TYPE "CustomerApprovalStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN "customerRegistrationMode" "CustomerRegistrationMode" NOT NULL DEFAULT 'AUTO';

-- AlterTable Customer
ALTER TABLE "Customer" ADD COLUMN "approvalStatus" "CustomerApprovalStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Customer" ADD COLUMN "approvalNote" TEXT;
ALTER TABLE "Customer" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "approvedByUserId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "rejectionReason" TEXT;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Customer_organizationId_approvalStatus_idx" ON "Customer"("organizationId", "approvalStatus");
