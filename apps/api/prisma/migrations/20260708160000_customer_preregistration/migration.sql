-- CreateEnum
CREATE TYPE "CustomerDocumentType" AS ENUM ('CNPJ', 'CPF');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "documentType" "CustomerDocumentType",
ADD COLUMN "cnpj" TEXT,
ADD COLUMN "cpf" TEXT,
ADD COLUMN "legalName" TEXT,
ADD COLUMN "tradeName" TEXT,
ADD COLUMN "cep" TEXT,
ADD COLUMN "street" TEXT,
ADD COLUMN "number" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "cityIbgeCode" TEXT,
ADD COLUMN "stateRegistration" TEXT,
ADD COLUMN "buyerName" TEXT,
ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_cnpj_key" ON "Customer"("organizationId", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_cpf_key" ON "Customer"("organizationId", "cpf");

-- CreateIndex
CREATE INDEX "Customer_organizationId_state_city_idx" ON "Customer"("organizationId", "state", "city");
