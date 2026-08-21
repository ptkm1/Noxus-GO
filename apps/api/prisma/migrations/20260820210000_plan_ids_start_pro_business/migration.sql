-- IDs novos: start | pro | business.
-- Ordem importa: o `pro` antigo era o plano topo e vira `business` primeiro.

UPDATE "OrganizationSubscription" SET "planId" = 'business' WHERE "planId" = 'pro';
UPDATE "OrganizationSubscription" SET "planId" = 'pro' WHERE "planId" = 'growth';
UPDATE "OrganizationSubscription" SET "planId" = 'start' WHERE "planId" = 'starter';

UPDATE "CheckoutIntent" SET "planId" = 'business' WHERE "planId" = 'pro';
UPDATE "CheckoutIntent" SET "planId" = 'pro' WHERE "planId" = 'growth';
UPDATE "CheckoutIntent" SET "planId" = 'start' WHERE "planId" = 'starter';

ALTER TABLE "OrganizationSubscription" ALTER COLUMN "planId" SET DEFAULT 'start';
