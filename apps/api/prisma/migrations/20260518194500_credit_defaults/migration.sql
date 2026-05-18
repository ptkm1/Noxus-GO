-- Política de crédito na organização; títulos por cliente; pedidos aguardando aprovação de crédito.

CREATE TYPE "CreditPolicy" AS ENUM ('WARN_ONLY', 'BLOCK_ORDER', 'REQUIRE_APPROVAL');

CREATE TYPE "CreditTitleStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_CREDIT_APPROVAL';

ALTER TABLE "Organization" ADD COLUMN "creditPolicy" "CreditPolicy" NOT NULL DEFAULT 'WARN_ONLY';

ALTER TABLE "Customer" ADD COLUMN "creditLimit" DECIMAL(14,2),
ADD COLUMN "creditBlocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order" ADD COLUMN "creditHoldReasons" JSONB;

CREATE TABLE "CustomerCreditTitle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "CreditTitleStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCreditTitle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerCreditTitle_organizationId_customerId_idx" ON "CustomerCreditTitle"("organizationId", "customerId");

ALTER TABLE "CustomerCreditTitle" ADD CONSTRAINT "CustomerCreditTitle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerCreditTitle" ADD CONSTRAINT "CustomerCreditTitle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
