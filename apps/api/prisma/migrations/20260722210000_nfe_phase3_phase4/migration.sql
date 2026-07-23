-- CreateEnum
CREATE TYPE "FiscalTransmitJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterTable OrganizationFiscalConfig
ALTER TABLE "OrganizationFiscalConfig" ADD COLUMN "nfceSeries" INTEGER;
ALTER TABLE "OrganizationFiscalConfig" ADD COLUMN "nfceLastNumber" INTEGER;
ALTER TABLE "OrganizationFiscalConfig" ADD COLUMN "contingencyEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable FiscalNcm
ALTER TABLE "FiscalNcm" ADD COLUMN "fcpRate" DECIMAL(5,2);

-- AlterTable FiscalInvoice
ALTER TABLE "FiscalInvoice" ADD COLUMN "documentModel" INTEGER NOT NULL DEFAULT 55;
ALTER TABLE "FiscalInvoice" ADD COLUMN "tpEmis" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "FiscalInvoice" ADD COLUMN "contingencyJustification" TEXT;
ALTER TABLE "FiscalInvoice" ADD COLUMN "modFrete" TEXT NOT NULL DEFAULT '9';
ALTER TABLE "FiscalInvoice" ADD COLUMN "freightAmount" DECIMAL(14,2);
ALTER TABLE "FiscalInvoice" ADD COLUMN "volumeQty" DECIMAL(14,4);
ALTER TABLE "FiscalInvoice" ADD COLUMN "grossWeightKg" DECIMAL(14,3);
ALTER TABLE "FiscalInvoice" ADD COLUMN "netWeightKg" DECIMAL(14,3);

-- CreateTable
CREATE TABLE "FiscalTransmitJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "FiscalTransmitJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sefazReceipt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalTransmitJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalTransmitJob_status_nextRunAt_idx" ON "FiscalTransmitJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "FiscalTransmitJob_organizationId_status_idx" ON "FiscalTransmitJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "FiscalTransmitJob_invoiceId_idx" ON "FiscalTransmitJob"("invoiceId");

-- AddForeignKey
ALTER TABLE "FiscalTransmitJob" ADD CONSTRAINT "FiscalTransmitJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalTransmitJob" ADD CONSTRAINT "FiscalTransmitJob_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FiscalInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
