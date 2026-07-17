-- CreateEnum
CREATE TYPE "AccountsPayableStatus" AS ENUM ('AUTHORIZED', 'PENDING', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "Organization" ADD COLUMN "stateRegistration" TEXT;

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalFixedExpense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierId" TEXT,
    "costCenterId" TEXT,
    "historyId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "competenceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalFixedExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsPayable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT '1',
    "docNumber" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "supplierId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "competence" TIMESTAMP(3) NOT NULL,
    "historyId" TEXT,
    "complement" TEXT,
    "costCenterId" TEXT,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dailyInterest" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fine" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "carrier" TEXT,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "pixCode" TEXT,
    "barcode" TEXT,
    "digitableLine" TEXT,
    "status" "AccountsPayableStatus" NOT NULL DEFAULT 'AUTHORIZED',
    "postAndSettle" BOOLEAN NOT NULL DEFAULT false,
    "budgetAccount" TEXT,
    "budgetType" TEXT,
    "sector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsPayable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_organizationId_code_key" ON "CostCenter"("organizationId", "code");
CREATE INDEX "CostCenter_organizationId_idx" ON "CostCenter"("organizationId");

CREATE UNIQUE INDEX "ExpenseHistory_organizationId_code_key" ON "ExpenseHistory"("organizationId", "code");
CREATE INDEX "ExpenseHistory_organizationId_idx" ON "ExpenseHistory"("organizationId");

CREATE INDEX "OperationalFixedExpense_organizationId_active_idx" ON "OperationalFixedExpense"("organizationId", "active");

CREATE INDEX "AccountsPayable_organizationId_dueDate_idx" ON "AccountsPayable"("organizationId", "dueDate");
CREATE INDEX "AccountsPayable_organizationId_status_idx" ON "AccountsPayable"("organizationId", "status");
CREATE INDEX "AccountsPayable_organizationId_supplierId_idx" ON "AccountsPayable"("organizationId", "supplierId");

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseHistory" ADD CONSTRAINT "ExpenseHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperationalFixedExpense" ADD CONSTRAINT "OperationalFixedExpense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationalFixedExpense" ADD CONSTRAINT "OperationalFixedExpense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalFixedExpense" ADD CONSTRAINT "OperationalFixedExpense_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalFixedExpense" ADD CONSTRAINT "OperationalFixedExpense_historyId_fkey" FOREIGN KEY ("historyId") REFERENCES "ExpenseHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_historyId_fkey" FOREIGN KEY ("historyId") REFERENCES "ExpenseHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
