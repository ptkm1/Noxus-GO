-- Evolui o ledger de estoque criado em 20260713210000_fiscal_module
-- (enum + tabela StockMovement com shape antigo) para o modelo com lotes/auditoria.
-- Idempotente: seguro em DBs que já têm o tipo/tabela fiscal ou que falharam a meio.

-- Extende o enum (já existe desde o módulo fiscal; NÃO recriar).
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'ADJUST';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'SALE';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'SALE_REVERSAL';

-- User.matricula
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "matricula" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_organizationId_matricula_key"
  ON "User"("organizationId", "matricula");

CREATE INDEX IF NOT EXISTS "Product_organizationId_categoryId_idx"
  ON "Product"("organizationId", "categoryId");

-- ProductLot
CREATE TABLE IF NOT EXISTS "ProductLot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "lotCode" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductLot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductLot_productId_lotCode_key"
  ON "ProductLot"("productId", "lotCode");

CREATE INDEX IF NOT EXISTS "ProductLot_organizationId_expiresAt_idx"
  ON "ProductLot"("organizationId", "expiresAt");

CREATE INDEX IF NOT EXISTS "ProductLot_productId_expiresAt_idx"
  ON "ProductLot"("productId", "expiresAt");

DO $$ BEGIN
  ALTER TABLE "ProductLot"
    ADD CONSTRAINT "ProductLot_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProductLot"
    ADD CONSTRAINT "ProductLot_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- StockMovement: cria do zero OU migra do shape fiscal (quantity/quantityAfter/...).
DO $$
BEGIN
  IF TO_REGCLASS('public."StockMovement"') IS NULL THEN
    CREATE TABLE "StockMovement" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "type" "StockMovementType" NOT NULL,
      "qtyDelta" INTEGER NOT NULL,
      "balanceAfter" INTEGER NOT NULL,
      "lotId" TEXT,
      "lotCode" TEXT,
      "expiresAt" TIMESTAMP(3),
      "userId" TEXT,
      "orderId" TEXT,
      "reason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
    );
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'StockMovement' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "qtyDelta" INTEGER;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "balanceAfter" INTEGER;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "lotId" TEXT;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "lotCode" TEXT;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "userId" TEXT;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reason" TEXT;

    -- Backfill a partir do shape fiscal. Em MANUAL_ADJUST o `quantity` era saldo-alvo
    -- absoluto (não delta); sem o saldo anterior marcamos qtyDelta = 0.
    UPDATE "StockMovement" SET
      "qtyDelta" = CASE
        WHEN "type"::text IN ('MANUAL_OUT', 'OUTBOUND_INVOICE') THEN -TRUNC("quantity")::integer
        WHEN "type"::text IN ('MANUAL_ADJUST', 'ADJUST') THEN 0
        ELSE TRUNC("quantity")::integer
      END,
      "balanceAfter" = TRUNC(COALESCE("quantityAfter", "quantity", 0))::integer,
      "userId" = COALESCE("userId", "createdByUserId"),
      "reason" = COALESCE(
        "reason",
        NULLIF(
          CONCAT_WS(
            ' — ',
            NULLIF("notes", ''),
            CASE
              WHEN "referenceType" IS NOT NULL AND "referenceId" IS NOT NULL
                THEN "referenceType" || ':' || "referenceId"
              ELSE NULLIF("referenceType", '')
            END
          ),
          ''
        )
      )
    WHERE "qtyDelta" IS NULL OR "balanceAfter" IS NULL;

    UPDATE "StockMovement" SET "qtyDelta" = 0 WHERE "qtyDelta" IS NULL;
    UPDATE "StockMovement" SET "balanceAfter" = 0 WHERE "balanceAfter" IS NULL;

    ALTER TABLE "StockMovement" ALTER COLUMN "qtyDelta" SET NOT NULL;
    ALTER TABLE "StockMovement" ALTER COLUMN "balanceAfter" SET NOT NULL;

    ALTER TABLE "StockMovement" DROP COLUMN IF EXISTS "quantity";
    ALTER TABLE "StockMovement" DROP COLUMN IF EXISTS "quantityAfter";
    ALTER TABLE "StockMovement" DROP COLUMN IF EXISTS "referenceType";
    ALTER TABLE "StockMovement" DROP COLUMN IF EXISTS "referenceId";
    ALTER TABLE "StockMovement" DROP COLUMN IF EXISTS "notes";
    ALTER TABLE "StockMovement" DROP COLUMN IF EXISTS "createdByUserId";
  ELSE
    -- Já no shape novo (ou parcial): garante colunas.
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "qtyDelta" INTEGER;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "balanceAfter" INTEGER;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "lotId" TEXT;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "lotCode" TEXT;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "userId" TEXT;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
    ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reason" TEXT;

    UPDATE "StockMovement" SET "qtyDelta" = 0 WHERE "qtyDelta" IS NULL;
    UPDATE "StockMovement" SET "balanceAfter" = 0 WHERE "balanceAfter" IS NULL;

    ALTER TABLE "StockMovement" ALTER COLUMN "qtyDelta" SET NOT NULL;
    ALTER TABLE "StockMovement" ALTER COLUMN "balanceAfter" SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "StockMovement_organizationId_createdAt_idx"
  ON "StockMovement"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "StockMovement_productId_createdAt_idx"
  ON "StockMovement"("productId", "createdAt");

CREATE INDEX IF NOT EXISTS "StockMovement_orderId_idx"
  ON "StockMovement"("orderId");

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

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_lotId_fkey"
    FOREIGN KEY ("lotId") REFERENCES "ProductLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "userMatricula" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx"
  ON "AuditLog"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_entityType_entityId_idx"
  ON "AuditLog"("organizationId", "entityType", "entityId");

DO $$ BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
