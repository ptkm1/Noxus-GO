-- Slim AccountsPayable: drop competitor ERP fields unused in Pedidos.
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "docType";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "sequence";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "complement";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "discount";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "dailyInterest";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "fine";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "balance";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "carrier";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "installments";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "pixCode";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "barcode";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "digitableLine";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "postAndSettle";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "budgetAccount";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "budgetType";
ALTER TABLE "AccountsPayable" DROP COLUMN IF EXISTS "sector";

ALTER TABLE "AccountsPayable" ADD COLUMN IF NOT EXISTS "notes" TEXT;
