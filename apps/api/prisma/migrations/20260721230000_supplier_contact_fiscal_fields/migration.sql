-- Colunas fiscais/contato do fornecedor (já no schema Prisma; faltavam no banco).
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "stateRegistration" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "street" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "addressNumber" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "complement" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "zipCode" TEXT;
