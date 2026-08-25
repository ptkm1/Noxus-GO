-- Multi-CNPJ: Establishment within Organization (shared stock, per-CNPJ fiscal)

CREATE TABLE "Establishment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
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
    "nfceSeries" INTEGER,
    "nfceLastNumber" INTEGER,
    "contingencyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "certificatePfxEncrypted" BYTEA,
    "certificatePasswordEncrypted" TEXT,
    "certificateExpiresAt" TIMESTAMP(3),
    "certificateCnpj" TEXT,
    "certificateLastAlertThreshold" INTEGER,
    "autoStockOnInboundInvoice" BOOLEAN NOT NULL DEFAULT false,
    "danfeLogoBytes" BYTEA,
    "danfeLogoMimeType" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Establishment_pkey" PRIMARY KEY ("id")
);

-- Backfill from OrganizationFiscalConfig (primary establishment)
INSERT INTO "Establishment" (
  "id", "organizationId", "legalName", "tradeName", "cnpj",
  "stateRegistration", "municipalRegistration", "taxRegime",
  "uf", "cityIbge", "street", "addressNumber", "complement", "district", "city", "zipCode",
  "nfeEnvironment", "nfeSeries", "nfeLastNumber", "nfceSeries", "nfceLastNumber",
  "contingencyEnabled",
  "certificatePfxEncrypted", "certificatePasswordEncrypted", "certificateExpiresAt",
  "certificateCnpj", "certificateLastAlertThreshold",
  "autoStockOnInboundInvoice", "danfeLogoBytes", "danfeLogoMimeType",
  "isPrimary", "active", "createdAt", "updatedAt"
)
SELECT
  fc."id",
  fc."organizationId",
  COALESCE(NULLIF(o."displayName", ''), NULLIF(o."name", ''), 'Estabelecimento principal'),
  o."displayName",
  COALESCE(fc."cnpj", o."cnpj", o."document"),
  COALESCE(fc."stateRegistration", o."stateRegistration"),
  fc."municipalRegistration",
  fc."taxRegime",
  fc."uf",
  fc."cityIbge",
  fc."street",
  fc."addressNumber",
  fc."complement",
  fc."district",
  fc."city",
  fc."zipCode",
  fc."nfeEnvironment",
  fc."nfeSeries",
  fc."nfeLastNumber",
  fc."nfceSeries",
  fc."nfceLastNumber",
  fc."contingencyEnabled",
  fc."certificatePfxEncrypted",
  fc."certificatePasswordEncrypted",
  fc."certificateExpiresAt",
  fc."certificateCnpj",
  fc."certificateLastAlertThreshold",
  fc."autoStockOnInboundInvoice",
  fc."danfeLogoBytes",
  fc."danfeLogoMimeType",
  true,
  true,
  fc."createdAt",
  fc."updatedAt"
FROM "OrganizationFiscalConfig" fc
JOIN "Organization" o ON o."id" = fc."organizationId";

-- Orgs without fiscal config still get a primary establishment
INSERT INTO "Establishment" (
  "id", "organizationId", "legalName", "tradeName", "cnpj",
  "stateRegistration", "isPrimary", "active", "createdAt", "updatedAt"
)
SELECT
  'est_' || substr(md5(o."id" || '-primary'), 1, 24),
  o."id",
  COALESCE(NULLIF(o."displayName", ''), NULLIF(o."name", ''), 'Estabelecimento principal'),
  o."displayName",
  COALESCE(o."cnpj", o."document"),
  o."stateRegistration",
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "Establishment" e WHERE e."organizationId" = o."id"
);

CREATE UNIQUE INDEX "Establishment_organizationId_cnpj_key" ON "Establishment"("organizationId", "cnpj");
CREATE INDEX "Establishment_organizationId_active_idx" ON "Establishment"("organizationId", "active");
CREATE INDEX "Establishment_organizationId_isPrimary_idx" ON "Establishment"("organizationId", "isPrimary");

ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Order.establishmentId
ALTER TABLE "Order" ADD COLUMN "establishmentId" TEXT;

UPDATE "Order" o
SET "establishmentId" = e."id"
FROM "Establishment" e
WHERE e."organizationId" = o."organizationId" AND e."isPrimary" = true;

ALTER TABLE "Order" ALTER COLUMN "establishmentId" SET NOT NULL;

CREATE INDEX "Order_organizationId_establishmentId_idx" ON "Order"("organizationId", "establishmentId");
CREATE INDEX "Order_establishmentId_idx" ON "Order"("establishmentId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_establishmentId_fkey"
  FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FiscalInvoice.establishmentId
ALTER TABLE "FiscalInvoice" ADD COLUMN "establishmentId" TEXT;

UPDATE "FiscalInvoice" fi
SET "establishmentId" = o."establishmentId"
FROM "Order" o
WHERE fi."orderId" = o."id";

UPDATE "FiscalInvoice" fi
SET "establishmentId" = e."id"
FROM "Establishment" e
WHERE fi."establishmentId" IS NULL
  AND e."organizationId" = fi."organizationId"
  AND e."isPrimary" = true;

CREATE INDEX "FiscalInvoice_organizationId_establishmentId_idx" ON "FiscalInvoice"("organizationId", "establishmentId");
CREATE INDEX "FiscalInvoice_establishmentId_idx" ON "FiscalInvoice"("establishmentId");

ALTER TABLE "FiscalInvoice" ADD CONSTRAINT "FiscalInvoice_establishmentId_fkey"
  FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- User preference / permissions
ALTER TABLE "User" ADD COLUMN "preferredEstablishmentId" TEXT;
ALTER TABLE "User" ADD COLUMN "allowedEstablishmentIds" JSONB;

CREATE INDEX "User_preferredEstablishmentId_idx" ON "User"("preferredEstablishmentId");

ALTER TABLE "User" ADD CONSTRAINT "User_preferredEstablishmentId_fkey"
  FOREIGN KEY ("preferredEstablishmentId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop legacy 1:1 fiscal config (data already copied)
DROP TABLE "OrganizationFiscalConfig";
