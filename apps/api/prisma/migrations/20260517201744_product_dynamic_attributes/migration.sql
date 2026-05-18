-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "attributes" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "product_categories" ADD COLUMN     "attributeSchema" JSONB;
