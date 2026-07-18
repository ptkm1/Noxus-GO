-- Módulo fiscal completo (idempotente para ambientes que já usaram db push).

DO $$ BEGIN
  CREATE TYPE "FiscalDocumentDirection" AS ENUM ('OUTBOUND', 'INBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FiscalInvoiceStatus" AS ENUM ('DRAFT', 'TRANSMITTED', 'AUTHORIZED', 'REJECTED', 'CANCELLED', 'IMPORTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NfeEnvironment" AS ENUM ('HOMOLOGATION', 'PRODUCTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FiscalTaxRegime" AS ENUM ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FiscalOperationDirection" AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StockMovementType" AS ENUM ('MANUAL_IN', 'MANUAL_OUT', 'MANUAL_ADJUST', 'INBOUND_INVOICE', 'OUTBOUND_INVOICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FiscalManifestationType" AS ENUM ('CIENCIA', 'CONFIRMACAO', 'DESCONHECIMENTO', 'NAO_REALIZADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OrganizationFiscalConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "cnpj" TEXT,
  "stateRegistration" TEXT,
  "municipalRegistration" TEXT,
  "taxRegime" "FiscalTaxRegime" NOT NULL DEFAULT 'SIMPLES_NACIONAL',
  "uf" TEXT,
  "cityIbge" TEXT,
  "street" TEXT,
  "addressNumber" TEXT,
  "complement" TEXT,
  "district" TEXT,
  "city" TEXT,
  "zipCode" TEXT,
  "nfeEnvironment" "NfeEnvironment" NOT NULL DEFAULT 'HOMOLOGATION',
  "nfeSeries" INTEGER NOT NULL DEFAULT 1,
  "nfeLastNumber" INTEGER NOT NULL DEFAULT 0,
  "certificatePfxEncrypted" BYTEA,
  "certificatePasswordEncrypted" TEXT,
  "certificateExpiresAt" TIMESTAMP(3),
  "certificateCnpj" TEXT,
  "autoStockOnInboundInvoice" BOOLEAN NOT NULL DEFAULT false,
  "danfeLogoBytes" BYTEA,
  "danfeLogoMimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationFiscalConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationFiscalConfig_organizationId_key"
  ON "OrganizationFiscalConfig"("organizationId");

DO $$ BEGIN
  ALTER TABLE "OrganizationFiscalConfig"
    ADD CONSTRAINT "OrganizationFiscalConfig_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "OrganizationFiscalConfig" ADD COLUMN IF NOT EXISTS "danfeLogoBytes" BYTEA;
ALTER TABLE "OrganizationFiscalConfig" ADD COLUMN IF NOT EXISTS "danfeLogoMimeType" TEXT;

CREATE TABLE IF NOT EXISTS "FiscalNcm" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "cest" TEXT,
  "defaultCstIcms" TEXT,
  "defaultCsosn" TEXT,
  "icmsRate" DECIMAL(5,2),
  "pisRate" DECIMAL(5,2),
  "cofinsRate" DECIMAL(5,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalNcm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalNcm_organizationId_code_key"
  ON "FiscalNcm"("organizationId", "code");

DO $$ BEGIN
  ALTER TABLE "FiscalNcm"
    ADD CONSTRAINT "FiscalNcm_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FiscalOperation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "direction" "FiscalOperationDirection" NOT NULL,
  "cfop" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "nature" TEXT,
  "defaultCstIcms" TEXT,
  "defaultCsosn" TEXT,
  "movesStock" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalOperation_organizationId_direction_cfop_key"
  ON "FiscalOperation"("organizationId", "direction", "cfop");

DO $$ BEGIN
  ALTER TABLE "FiscalOperation"
    ADD CONSTRAINT "FiscalOperation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ncmId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fiscalOrigin" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fiscalGtin" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fiscalUnit" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fiscalCest" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fiscalDescription" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "outboundOperationId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Product"
    ADD CONSTRAINT "Product_ncmId_fkey"
    FOREIGN KEY ("ncmId") REFERENCES "FiscalNcm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Product"
    ADD CONSTRAINT "Product_outboundOperationId_fkey"
    FOREIGN KEY ("outboundOperationId") REFERENCES "FiscalOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FiscalInvoice" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "direction" "FiscalDocumentDirection" NOT NULL,
  "status" "FiscalInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "orderId" TEXT,
  "supplierId" TEXT,
  "customerId" TEXT,
  "number" INTEGER,
  "series" INTEGER,
  "accessKey" TEXT,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "xmlSigned" TEXT,
  "xmlAuthorized" TEXT,
  "protocol" TEXT,
  "rejectionReason" TEXT,
  "issuerSnapshot" JSONB,
  "recipientSnapshot" JSONB,
  "stockApplied" BOOLEAN NOT NULL DEFAULT false,
  "manifestationType" "FiscalManifestationType",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalInvoice_accessKey_key" ON "FiscalInvoice"("accessKey");
CREATE INDEX IF NOT EXISTS "FiscalInvoice_organizationId_direction_status_idx"
  ON "FiscalInvoice"("organizationId", "direction", "status");
CREATE INDEX IF NOT EXISTS "FiscalInvoice_organizationId_orderId_idx"
  ON "FiscalInvoice"("organizationId", "orderId");

DO $$ BEGIN
  ALTER TABLE "FiscalInvoice"
    ADD CONSTRAINT "FiscalInvoice_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FiscalInvoice"
    ADD CONSTRAINT "FiscalInvoice_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FiscalInvoice"
    ADD CONSTRAINT "FiscalInvoice_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FiscalInvoiceItem" (
  "id" TEXT NOT NULL,
  "fiscalInvoiceId" TEXT NOT NULL,
  "productId" TEXT,
  "lineNumber" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "ncm" TEXT,
  "cfop" TEXT,
  "unit" TEXT,
  "quantity" DECIMAL(14,4) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "totalPrice" DECIMAL(14,2) NOT NULL,
  "supplierProductCode" TEXT,
  "taxSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalInvoiceItem_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "FiscalInvoiceItem"
    ADD CONSTRAINT "FiscalInvoiceItem_fiscalInvoiceId_fkey"
    FOREIGN KEY ("fiscalInvoiceId") REFERENCES "FiscalInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FiscalInvoiceItem"
    ADD CONSTRAINT "FiscalInvoiceItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FiscalInvoiceEvent" (
  "id" TEXT NOT NULL,
  "fiscalInvoiceId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "requestPayload" TEXT,
  "responsePayload" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalInvoiceEvent_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "FiscalInvoiceEvent"
    ADD CONSTRAINT "FiscalInvoiceEvent_fiscalInvoiceId_fkey"
    FOREIGN KEY ("fiscalInvoiceId") REFERENCES "FiscalInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ProductStock" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantityOnHand" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductStock_productId_key" ON "ProductStock"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductStock_organizationId_productId_key"
  ON "ProductStock"("organizationId", "productId");

DO $$ BEGIN
  ALTER TABLE "ProductStock"
    ADD CONSTRAINT "ProductStock_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProductStock"
    ADD CONSTRAINT "ProductStock_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "StockMovement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity" DECIMAL(14,4) NOT NULL,
  "quantityAfter" DECIMAL(14,4) NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockMovement_organizationId_productId_idx"
  ON "StockMovement"("organizationId", "productId");
CREATE INDEX IF NOT EXISTS "StockMovement_organizationId_createdAt_idx"
  ON "StockMovement"("organizationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
