-- CreateTable
CREATE TABLE "PurchaseUnit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseUnit_organizationId_sortOrder_idx" ON "PurchaseUnit"("organizationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseUnit_organizationId_code_key" ON "PurchaseUnit"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "PurchaseUnit" ADD CONSTRAINT "PurchaseUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unidades padrão (UN/CX/FD/KG/L) para orgs já existentes — produtos seguem gravando o código.
INSERT INTO "PurchaseUnit" ("id", "organizationId", "code", "name", "sortOrder", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."id", d.code, d.name, d.sort_order, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (
    VALUES
        ('UN', 'Unidade', 1),
        ('CX', 'Caixa', 2),
        ('FD', 'Fardo', 3),
        ('KG', 'Quilograma', 4),
        ('L', 'Litro', 5)
) AS d(code, name, sort_order)
ON CONFLICT ("organizationId", "code") DO NOTHING;
