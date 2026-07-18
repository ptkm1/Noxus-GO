import type { Role } from "@prisma/client";
import {
  defaultPermissionRows,
  EDITABLE_ROLES,
  getPermission,
  isPermissionLevel,
  isPermissionResource,
  LOCKED_ROLES,
  PERMISSION_RESOURCE_LABELS,
  PERMISSION_RESOURCES,
  ROLE_LABELS,
  type PermissionLevel,
  type PermissionResource,
} from "../auth/permissions.js";
import { prisma } from "../db.js";

type LevelMap = Record<Role, Record<PermissionResource, PermissionLevel>>;

const cache = new Map<string, { at: number; map: LevelMap }>();
const CACHE_TTL_MS = 30_000;

function emptyLevelMap(): LevelMap {
  const roles: Role[] = ["ADMIN", "MANAGER", "SELLER", "SUPERVISOR"];
  const map = {} as LevelMap;
  for (const role of roles) {
    map[role] = {} as Record<PermissionResource, PermissionLevel>;
    for (const resource of PERMISSION_RESOURCES) {
      map[role][resource] = getPermission(role, resource);
    }
  }
  return map;
}

function invalidateCache(organizationId: string) {
  cache.delete(organizationId);
}

/** Garante linhas default para a org (idempotente). */
export async function ensureOrgRolePermissions(
  organizationId: string,
): Promise<void> {
  const rows = defaultPermissionRows();
  const created = await prisma.organizationRolePermission.createMany({
    data: rows.map((r) => ({
      organizationId,
      role: r.role,
      resource: r.resource,
      level: r.level,
    })),
    skipDuplicates: true,
  });
  if (created.count > 0) invalidateCache(organizationId);
}

async function loadLevelMap(organizationId: string): Promise<LevelMap> {
  const hit = cache.get(organizationId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.map;

  await ensureOrgRolePermissions(organizationId);

  const rows = await prisma.organizationRolePermission.findMany({
    where: { organizationId },
    select: { role: true, resource: true, level: true },
  });

  const map = emptyLevelMap();
  for (const row of rows) {
    if (!isPermissionResource(row.resource)) continue;
    if (!isPermissionLevel(row.level)) continue;
    map[row.role][row.resource] = row.level;
  }

  // Proteção: ADMIN nunca perde users (write) nem permissions (pelo menos read).
  map.ADMIN.users = "write";
  if (map.ADMIN.permissions === "none") {
    map.ADMIN.permissions = "read";
  }

  cache.set(organizationId, { at: Date.now(), map });
  return map;
}

export async function getEffectivePermission(
  organizationId: string,
  role: Role,
  resource: PermissionResource,
): Promise<PermissionLevel> {
  const map = await loadLevelMap(organizationId);
  return map[role][resource] ?? "none";
}

export async function canReadEffective(
  organizationId: string,
  role: Role,
  resource: PermissionResource,
): Promise<boolean> {
  const level = await getEffectivePermission(organizationId, role, resource);
  return level === "read" || level === "write";
}

export async function canWriteEffective(
  organizationId: string,
  role: Role,
  resource: PermissionResource,
): Promise<boolean> {
  return (
    (await getEffectivePermission(organizationId, role, resource)) === "write"
  );
}

export async function getRolePermissionsMap(
  organizationId: string,
  role: Role,
): Promise<Record<PermissionResource, PermissionLevel>> {
  const map = await loadLevelMap(organizationId);
  return { ...map[role] };
}

export async function buildEffectivePermissionsMatrix(organizationId: string) {
  const map = await loadLevelMap(organizationId);
  const roles: Role[] = ["ADMIN", "MANAGER", "SELLER", "SUPERVISOR"];
  return {
    roles: roles.map((role) => ({
      role,
      label: ROLE_LABELS[role],
      hasSellerProfile: role === "SELLER",
      locked: LOCKED_ROLES.includes(role),
    })),
    resources: PERMISSION_RESOURCES.map((resource) => ({
      resource,
      label: PERMISSION_RESOURCE_LABELS[resource],
      levels: Object.fromEntries(
        roles.map((role) => [role, map[role][resource]]),
      ) as Record<Role, PermissionLevel>,
    })),
    editableRoles: EDITABLE_ROLES,
    lockedRoles: LOCKED_ROLES,
    notes: [
      "Gestor (MANAGER) é usuário de staff sem perfil Seller.",
      "A coluna Administrador é somente leitura no painel (evita lockout em Usuários/Permissões).",
      "Permissões efetivas vêm do banco (por organização), com defaults da matriz estática.",
      "Escritas em /admin continuam exigindo role ADMIN na API.",
      "SUPERVISOR existe no enum mas não tem acesso efetivo neste ciclo.",
    ],
  };
}

export type PermissionMatrixUpdate = {
  role: Role;
  resource: PermissionResource;
  level: PermissionLevel;
};

/** Atualiza apenas roles editáveis; ignora ADMIN (sempre defaults forçados). */
export async function updateOrgRolePermissions(
  organizationId: string,
  updates: PermissionMatrixUpdate[],
): Promise<Awaited<ReturnType<typeof buildEffectivePermissionsMatrix>>> {
  await ensureOrgRolePermissions(organizationId);

  const allowed = updates.filter(
    (u) =>
      EDITABLE_ROLES.includes(u.role) &&
      isPermissionResource(u.resource) &&
      isPermissionLevel(u.level),
  );

  if (allowed.length > 0) {
    await prisma.$transaction(
      allowed.map((u) =>
        prisma.organizationRolePermission.upsert({
          where: {
            organizationId_role_resource: {
              organizationId,
              role: u.role,
              resource: u.resource,
            },
          },
          create: {
            organizationId,
            role: u.role,
            resource: u.resource,
            level: u.level,
          },
          update: { level: u.level },
        }),
      ),
    );
  }

  // Reafirma defaults da coluna ADMIN no banco.
  const adminDefaults = defaultPermissionRows().filter(
    (r) => r.role === "ADMIN",
  );
  await prisma.$transaction(
    adminDefaults.map((r) =>
      prisma.organizationRolePermission.upsert({
        where: {
          organizationId_role_resource: {
            organizationId,
            role: "ADMIN",
            resource: r.resource,
          },
        },
        create: {
          organizationId,
          role: "ADMIN",
          resource: r.resource,
          level: r.level,
        },
        update: { level: r.level },
      }),
    ),
  );

  invalidateCache(organizationId);
  return buildEffectivePermissionsMatrix(organizationId);
}

/** Mapeia path do plugin /admin → recurso da matriz (GET). */
export function adminPathToResource(
  routePath: string,
): PermissionResource | null {
  const path = routePath.split("?")[0] ?? routePath;
  if (path === "/" || path === "") return "dashboard";
  if (path.startsWith("/products") || path.startsWith("/product-categories"))
    return "products";
  if (path.startsWith("/stock")) return "stock";
  if (path.startsWith("/suppliers")) return "suppliers";
  if (
    path.startsWith("/fiscal") ||
    path.startsWith("/fixed-expenses") ||
    path.startsWith("/accounts-payable") ||
    path.startsWith("/cost-centers") ||
    path.startsWith("/expense-histories") ||
    path.startsWith("/nfe")
  )
    return "fiscal";
  if (path.startsWith("/customers") || path.startsWith("/credit"))
    return "customers";
  if (path.startsWith("/orders")) return "orders";
  if (
    path.startsWith("/sellers") ||
    path.startsWith("/managers") ||
    path.startsWith("/seller-locations")
  ) {
    if (path.startsWith("/seller-locations")) return "tracking";
    return "sellers";
  }
  if (path.startsWith("/teams") || path.startsWith("/sales-teams"))
    return "teams";
  if (path.startsWith("/users") || path.startsWith("/staff")) return "users";
  if (path.startsWith("/customer-visits")) return "visits";
  if (path.startsWith("/reports") || path.startsWith("/insights"))
    return "reports";
  if (path.startsWith("/commission") || path.startsWith("/goals"))
    return "commissions";
  if (path.startsWith("/price-tables") || path.startsWith("/pricing"))
    return "price_tables";
  if (path.startsWith("/permissions")) return "permissions";
  if (path.startsWith("/audit")) return "audit";
  if (path.startsWith("/notifications/send")) return "broadcast";
  return null;
}
