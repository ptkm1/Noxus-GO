-- Product: CST/CSOSN e classificação IBS explícitos
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ibsClassification" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fiscalCstIcms" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fiscalCsosn" TEXT;

-- Catálogo nacional de códigos fiscais (importável / versionado)
CREATE TABLE IF NOT EXISTS "FiscalCatalogCode" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sourceVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalCatalogCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalCatalogCode_type_code_key"
  ON "FiscalCatalogCode"("type", "code");

CREATE INDEX IF NOT EXISTS "FiscalCatalogCode_type_active_idx"
  ON "FiscalCatalogCode"("type", "active");

CREATE INDEX IF NOT EXISTS "FiscalCatalogCode_type_code_idx"
  ON "FiscalCatalogCode"("type", "code");

CREATE INDEX IF NOT EXISTS "FiscalCatalogCode_description_idx"
  ON "FiscalCatalogCode"("description");
