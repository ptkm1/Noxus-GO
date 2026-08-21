-- Novo padrão: indicadores da home em grade (lado a lado).
-- Não altera valores já persistidos (ex.: "stack" escolhido de propósito).
ALTER TABLE "Organization" ALTER COLUMN "homeIndicatorsLayout" SET DEFAULT 'grid';
