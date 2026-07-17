-- Logo da empresa no DANFE / documentos fiscais (PNG, JPEG, etc.)
ALTER TABLE "OrganizationFiscalConfig" ADD COLUMN IF NOT EXISTS "danfeLogoBytes" BYTEA;
ALTER TABLE "OrganizationFiscalConfig" ADD COLUMN IF NOT EXISTS "danfeLogoMimeType" TEXT;
