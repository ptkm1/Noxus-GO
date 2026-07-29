-- OrderSituation já foi criada em 20260722190000_order_situation.
-- Esta migration só adiciona enabledRoles na Organization.

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "enabledRoles" JSONB NOT NULL DEFAULT '["ADMIN","MANAGER","SELLER"]';
