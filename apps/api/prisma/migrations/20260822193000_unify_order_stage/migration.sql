-- Etapas de sistema (Rascunho / Aguardando crédito) por organização
INSERT INTO "OrderSituation" (
  "id",
  "organizationId",
  "code",
  "name",
  "sortOrder",
  "active",
  "isSystem",
  "mapsToCancel",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(o.id || ':DRAFT'),
  o.id,
  'DRAFT',
  'Rascunho',
  0,
  true,
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrderSituation" s
  WHERE s."organizationId" = o.id AND s.code = 'DRAFT'
);

INSERT INTO "OrderSituation" (
  "id",
  "organizationId",
  "code",
  "name",
  "sortOrder",
  "active",
  "isSystem",
  "mapsToCancel",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(o.id || ':CREDIT'),
  o.id,
  'CREDIT',
  'Aguardando crédito',
  1,
  true,
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrderSituation" s
  WHERE s."organizationId" = o.id AND s.code = 'CREDIT'
);

-- Garante CANCELLED / DELIVERED / OPEN do sistema (orgs antigas)
INSERT INTO "OrderSituation" (
  "id",
  "organizationId",
  "code",
  "name",
  "sortOrder",
  "active",
  "isSystem",
  "mapsToCancel",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(o.id || ':OPEN'),
  o.id,
  'OPEN',
  'Aberto',
  2,
  true,
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrderSituation" s
  WHERE s."organizationId" = o.id AND s.code = 'OPEN'
);

INSERT INTO "OrderSituation" (
  "id",
  "organizationId",
  "code",
  "name",
  "sortOrder",
  "active",
  "isSystem",
  "mapsToCancel",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(o.id || ':DELIVERED'),
  o.id,
  'DELIVERED',
  'Entregue',
  6,
  true,
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrderSituation" s
  WHERE s."organizationId" = o.id AND s.code = 'DELIVERED'
);

INSERT INTO "OrderSituation" (
  "id",
  "organizationId",
  "code",
  "name",
  "sortOrder",
  "active",
  "isSystem",
  "mapsToCancel",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(o.id || ':CANCELLED'),
  o.id,
  'CANCELLED',
  'Cancelado',
  7,
  true,
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrderSituation" s
  WHERE s."organizationId" = o.id AND s.code = 'CANCELLED'
);

UPDATE "OrderSituation" SET "isSystem" = true, "mapsToCancel" = true
WHERE code = 'CANCELLED';

UPDATE "OrderSituation" SET "isSystem" = true
WHERE code IN ('DRAFT', 'CREDIT', 'OPEN', 'PICKING', 'PACKED', 'SENT', 'DELIVERED', 'CANCELLED');

-- Backfill: status interno → etapa
UPDATE "Order" o
SET "situationId" = s.id
FROM "OrderSituation" s
WHERE o."organizationId" = s."organizationId"
  AND s.code = 'DRAFT'
  AND o.status = 'DRAFT';

UPDATE "Order" o
SET "situationId" = s.id
FROM "OrderSituation" s
WHERE o."organizationId" = s."organizationId"
  AND s.code = 'CREDIT'
  AND o.status = 'PENDING_CREDIT_APPROVAL';

UPDATE "Order" o
SET "situationId" = s.id
FROM "OrderSituation" s
WHERE o."organizationId" = s."organizationId"
  AND s.code = 'CANCELLED'
  AND o.status = 'CANCELLED';

UPDATE "Order" o
SET "situationId" = s.id
FROM "OrderSituation" s
WHERE o."organizationId" = s."organizationId"
  AND s.code = 'OPEN'
  AND o.status = 'CONFIRMED'
  AND o."situationId" IS NULL;

-- Qualquer residual sem etapa → Aberto (ou Cancelado se status cancelado já tratado)
UPDATE "Order" o
SET "situationId" = s.id
FROM "OrderSituation" s
WHERE o."organizationId" = s."organizationId"
  AND s.code = 'OPEN'
  AND o."situationId" IS NULL;

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_situationId_fkey";

ALTER TABLE "Order" ALTER COLUMN "situationId" SET NOT NULL;

ALTER TABLE "Order" ADD CONSTRAINT "Order_situationId_fkey"
  FOREIGN KEY ("situationId") REFERENCES "OrderSituation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
