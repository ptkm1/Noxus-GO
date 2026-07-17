-- Supplier: cria tabela nova ou evolui schema fiscal antigo (name/document) para commerce+fiscal.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Supplier'
  ) THEN
    CREATE TABLE "Supplier" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "legalName" TEXT NOT NULL,
      "cnpj" TEXT NOT NULL,
      "tradeName" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
    );
  ELSE
    ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "code" TEXT;
    ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
    ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "cnpj" TEXT;
    ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "tradeName" TEXT;
    ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'name'
    ) THEN
      UPDATE "Supplier"
      SET
        "cnpj" = COALESCE(
          NULLIF(REGEXP_REPLACE(COALESCE("document", ''), '[^0-9]', '', 'g'), ''),
          "id"
        ),
        "legalName" = COALESCE(NULLIF(TRIM("name"), ''), 'Fornecedor'),
        "tradeName" = COALESCE(NULLIF(TRIM("name"), ''), 'Fornecedor'),
        "code" = COALESCE(
          NULLIF(
            UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE("document", ''), '[^0-9]', '', 'g') FROM 1 FOR 8)),
            ''
          ),
          'SUP-' || SUBSTRING("id" FROM 1 FOR 8)
        )
      WHERE "code" IS NULL OR "legalName" IS NULL OR "cnpj" IS NULL OR "tradeName" IS NULL;

      DROP INDEX IF EXISTS "Supplier_organizationId_document_key";
      ALTER TABLE "Supplier" DROP COLUMN IF EXISTS "name";
      ALTER TABLE "Supplier" DROP COLUMN IF EXISTS "document";
    END IF;

    ALTER TABLE "Supplier" ALTER COLUMN "code" SET NOT NULL;
    ALTER TABLE "Supplier" ALTER COLUMN "legalName" SET NOT NULL;
    ALTER TABLE "Supplier" ALTER COLUMN "cnpj" SET NOT NULL;
    ALTER TABLE "Supplier" ALTER COLUMN "tradeName" SET NOT NULL;
  END IF;
END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

CREATE INDEX IF NOT EXISTS "Supplier_organizationId_idx" ON "Supplier"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_organizationId_code_key" ON "Supplier"("organizationId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_organizationId_cnpj_key" ON "Supplier"("organizationId", "cnpj");
CREATE INDEX IF NOT EXISTS "Product_organizationId_supplierId_idx" ON "Product"("organizationId", "supplierId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Supplier_organizationId_fkey'
  ) THEN
    ALTER TABLE "Supplier"
      ADD CONSTRAINT "Supplier_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_supplierId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
