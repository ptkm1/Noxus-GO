-- CreateEnum
CREATE TYPE "OrganizationAccessStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AccountActivationPurpose" AS ENUM ('OWNER_ACTIVATION', 'USER_INVITE');

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'SUSPENDED';

-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN "accessStatus" "OrganizationAccessStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Organization" ADD COLUMN "document" TEXT;

CREATE UNIQUE INDEX "Organization_document_key" ON "Organization"("document");

-- AlterTable OrganizationSubscription
ALTER TABLE "OrganizationSubscription" ADD COLUMN "providerCheckoutId" TEXT;
ALTER TABLE "OrganizationSubscription" ADD COLUMN "gracePeriodEndsAt" TIMESTAMP(3);

CREATE INDEX "OrganizationSubscription_providerCustomerId_idx" ON "OrganizationSubscription"("providerCustomerId");
CREATE UNIQUE INDEX "OrganizationSubscription_providerSubscriptionId_key" ON "OrganizationSubscription"("providerSubscriptionId");
CREATE UNIQUE INDEX "OrganizationSubscription_providerCheckoutId_key" ON "OrganizationSubscription"("providerCheckoutId");

-- AlterTable CheckoutIntent
ALTER TABLE "CheckoutIntent" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "CheckoutIntent" ADD COLUMN "adminName" TEXT;
ALTER TABLE "CheckoutIntent" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "CheckoutIntent" ADD COLUMN "providerCustomerId" TEXT;
ALTER TABLE "CheckoutIntent" ADD COLUMN "providerCheckoutId" TEXT;
ALTER TABLE "CheckoutIntent" ADD COLUMN "providerSubscriptionId" TEXT;
ALTER TABLE "CheckoutIntent" ADD COLUMN "checkoutUrl" TEXT;
ALTER TABLE "CheckoutIntent" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "CheckoutIntent" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "CheckoutIntent" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "CheckoutIntent" ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);

-- Migrate legacy pending → CREATED
UPDATE "CheckoutIntent" SET "status" = 'CREATED' WHERE "status" = 'pending';
ALTER TABLE "CheckoutIntent" ALTER COLUMN "status" SET DEFAULT 'CREATED';

CREATE INDEX "CheckoutIntent_providerCheckoutId_idx" ON "CheckoutIntent"("providerCheckoutId");
CREATE INDEX "CheckoutIntent_providerSubscriptionId_idx" ON "CheckoutIntent"("providerSubscriptionId");
CREATE INDEX "CheckoutIntent_organizationId_idx" ON "CheckoutIntent"("organizationId");

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "activatedAt" TIMESTAMP(3);
UPDATE "User" SET "activatedAt" = "createdAt" WHERE "activatedAt" IS NULL;

-- CreateTable PaymentProviderEvent
CREATE TABLE "PaymentProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "payloadSanitized" JSONB,

    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentProviderEvent_provider_providerEventId_key" ON "PaymentProviderEvent"("provider", "providerEventId");
CREATE INDEX "PaymentProviderEvent_eventType_receivedAt_idx" ON "PaymentProviderEvent"("eventType", "receivedAt");

-- CreateTable AccountActivationToken
CREATE TABLE "AccountActivationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "AccountActivationPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountActivationToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountActivationToken_userId_purpose_idx" ON "AccountActivationToken"("userId", "purpose");
CREATE INDEX "AccountActivationToken_expiresAt_idx" ON "AccountActivationToken"("expiresAt");

ALTER TABLE "AccountActivationToken" ADD CONSTRAINT "AccountActivationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
