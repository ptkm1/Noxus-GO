-- AlterTable
ALTER TABLE "Order" ADD COLUMN "clientMutationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_clientMutationId_key" ON "Order"("clientMutationId");
