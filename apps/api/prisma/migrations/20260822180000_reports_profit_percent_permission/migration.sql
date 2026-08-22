-- Permissão "percentual de lucro em relatórios": admin tem leitura; demais none.
INSERT INTO "OrganizationRolePermission" (
  "id", "organizationId", "role", "resource", "level", "createdAt", "updatedAt"
)
SELECT
  concat('orp-rpp-', o.id, '-', r.role),
  o.id,
  r.role::"Role",
  'reports_profit_percent',
  r.level::"AccessLevel",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (
  VALUES
    ('ADMIN'::text, 'read'::text),
    ('MANAGER'::text, 'none'::text),
    ('SELLER'::text, 'none'::text),
    ('SUPERVISOR'::text, 'none'::text)
) AS r(role, level)
ON CONFLICT ("organizationId", "role", "resource") DO NOTHING;
