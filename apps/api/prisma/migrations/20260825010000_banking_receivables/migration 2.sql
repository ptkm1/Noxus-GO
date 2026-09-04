-- CreateEnum
CREATE TYPE "BankingProviderKind" AS ENUM ('ITAU', 'BB', 'SANTANDER');

-- CreateEnum
CREATE TYPE "BankConnectionStatus" AS ENUM ('PENDING_SETUP', 'ACTIVE', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "BankingProviderKind" NOT NULL,
    "status" "BankConnectionStatus" NOT NULL DEFAULT 'PENDING_SETUP',
    "metadata" JSONB,
    "credentialsEncrypted" TEXT,
    "credentialsEnvPrefix" TEXT,
    "webhookSecretEncrypted" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "cnabEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "bankConnectionId" TEXT NOT NULL,
    "externalId" TEXT,
    "nossoNumero" TEXT,
    "digitableLine" TEXT,
    "barcode" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "ReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "externalStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankingWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "BankingProviderKind" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "organizationId" TEXT,
    "bankConnectionId" TEXT,
    "receivableId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "payloadSanitized" JSONB,

    CONSTRAINT "BankingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankConnection_organizationId_status_idx" ON "BankConnection"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BankConnection_organizationId_provider_key" ON "BankConnection"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "Receivable_organizationId_customerId_status_idx" ON "Receivable"("organizationId", "customerId", "status");

-- CreateIndex
CREATE INDEX "Receivable_organizationId_status_dueDate_idx" ON "Receivable"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Receivable_organizationId_orderId_idx" ON "Receivable"("organizationId", "orderId");

-- CreateIndex
CREATE INDEX "Receivable_bankConnectionId_nossoNumero_idx" ON "Receivable"("bankConnectionId", "nossoNumero");

-- CreateIndex
CREATE UNIQUE INDEX "Receivable_bankConnectionId_externalId_key" ON "Receivable"("bankConnectionId", "externalId");

-- CreateIndex
CREATE INDEX "BankingWebhookEvent_provider_receivedAt_idx" ON "BankingWebhookEvent"("provider", "receivedAt");

-- CreateIndex
CREATE INDEX "BankingWebhookEvent_organizationId_receivedAt_idx" ON "BankingWebhookEvent"("organizationId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankingWebhookEvent_provider_providerEventId_key" ON "BankingWebhookEvent"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_bankConnectionId_fkey" FOREIGN KEY ("bankConnectionId") REFERENCES "BankConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
