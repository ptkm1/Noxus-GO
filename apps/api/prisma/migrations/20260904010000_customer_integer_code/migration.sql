-- Código inteiro sequencial do cliente por organização (substitui fallback alfanumérico do CUID na UI).
ALTER TABLE "Customer" ADD COLUMN "code" INTEGER;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Customer"
)
UPDATE "Customer" AS c
SET "code" = ranked.rn
FROM ranked
WHERE c.id = ranked.id;

CREATE UNIQUE INDEX "Customer_organizationId_code_key" ON "Customer"("organizationId", "code");
