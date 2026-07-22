-- CreateEnum
CREATE TYPE "OrderSyncMode" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "orderSyncMode" "OrderSyncMode" NOT NULL DEFAULT 'AUTO';
