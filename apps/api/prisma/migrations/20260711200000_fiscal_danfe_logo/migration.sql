-- Logo da empresa no DANFE / documentos fiscais (PNG, JPEG, etc.).
-- Idempotente: a tabela OrganizationFiscalConfig pode ainda não existir
-- (é criada em 20260713210000_fiscal_module, que já inclui estas colunas).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'OrganizationFiscalConfig'
  ) THEN
    ALTER TABLE "OrganizationFiscalConfig" ADD COLUMN IF NOT EXISTS "danfeLogoBytes" BYTEA;
    ALTER TABLE "OrganizationFiscalConfig" ADD COLUMN IF NOT EXISTS "danfeLogoMimeType" TEXT;
  END IF;
END $$;
