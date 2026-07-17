-- Customer: cria colunas de pré-cadastro ou evolui schema fiscal antigo (document/zipCode).



DO $$ BEGIN

  CREATE TYPE "CustomerDocumentType" AS ENUM ('CNPJ', 'CPF');

EXCEPTION

  WHEN duplicate_object THEN NULL;

END $$;



ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "documentType" "CustomerDocumentType";

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "cnpj" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "cpf" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "legalName" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tradeName" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "cep" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "street" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "number" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "state" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "city" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "cityIbgeCode" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "stateRegistration" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "buyerName" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "notes" TEXT;



-- Migra dados do schema fiscal antigo quando existirem.

DO $$

BEGIN

  IF EXISTS (

    SELECT 1 FROM information_schema.columns

    WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'document'

  ) THEN

    UPDATE "Customer"

    SET

      "cnpj" = COALESCE(

        "cnpj",

        CASE

          WHEN "documentType" = 'CNPJ'

          THEN NULLIF(REGEXP_REPLACE(COALESCE("document", ''), '[^0-9]', '', 'g'), '')

        END

      ),

      "cpf" = COALESCE(

        "cpf",

        CASE

          WHEN "documentType" = 'CPF'

          THEN NULLIF(REGEXP_REPLACE(COALESCE("document", ''), '[^0-9]', '', 'g'), '')

        END

      ),

      "cep" = COALESCE("cep", "zipCode"),

      "cityIbgeCode" = COALESCE("cityIbgeCode", "cityIbge"),

      "neighborhood" = COALESCE("neighborhood", "district"),

      "number" = COALESCE("number", "addressNumber"),

      "legalName" = COALESCE("legalName", NULLIF(TRIM("name"), '')),

      "tradeName" = COALESCE("tradeName", NULLIF(TRIM("name"), ''));



    ALTER TABLE "Customer" DROP COLUMN IF EXISTS "document";

    ALTER TABLE "Customer" DROP COLUMN IF EXISTS "zipCode";

    ALTER TABLE "Customer" DROP COLUMN IF EXISTS "cityIbge";

    ALTER TABLE "Customer" DROP COLUMN IF EXISTS "complement";

    ALTER TABLE "Customer" DROP COLUMN IF EXISTS "district";

    ALTER TABLE "Customer" DROP COLUMN IF EXISTS "addressNumber";

  END IF;

END $$;



CREATE UNIQUE INDEX IF NOT EXISTS "Customer_organizationId_cnpj_key" ON "Customer"("organizationId", "cnpj");

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_organizationId_cpf_key" ON "Customer"("organizationId", "cpf");

CREATE INDEX IF NOT EXISTS "Customer_organizationId_state_city_idx" ON "Customer"("organizationId", "state", "city");
