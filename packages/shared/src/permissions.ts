import type { Role } from "@pedidos/shared";

export type PermissionLevel = "none" | "read" | "write";

export type PermissionResource =
  | "dashboard"
  | "products"
  | "stock"
  | "suppliers"
  | "customers"
  | "orders"
  | "sellers"
  | "teams"
  | "tracking"
  | "visits"
  | "reports"
  | "commissions"
  | "price_tables"
  | "permissions"
  | "audit";

/** Espelho da matriz da API para UI (manter alinhado com apps/api/src/auth/permissions.ts). */
export const ROLE_PERMISSIONS: Record<
  PermissionResource,
  Partial<Record<Role, PermissionLevel>>
> = {
  dashboard: {
    ADMIN: "read",
    MANAGER: "read",
    SELLER: "none",
    SUPERVISOR: "none",
  },
  products: {
    ADMIN: "write",
    MANAGER: "none",
    SELLER: "read",
    SUPERVISOR: "none",
  },
  stock: {
    ADMIN: "write",
    MANAGER: "none",
    SELLER: "none",
    SUPERVISOR: "none",
  },
  suppliers: {
    ADMIN: "write",
    MANAGER: "none",
    SELLER: "none",
    SUPERVISOR: "none",
  },
  customers: {
    ADMIN: "write",
    MANAGER: "none",
    SELLER: "write",
    SUPERVISOR: "none",
  },
  orders: {
    ADMIN: "write",
    MANAGER: "read",
    SELLER: "write",
    SUPERVISOR: "none",
  },
  sellers: {
    ADMIN: "write",
    MANAGER: "read",
    SELLER: "none",
    SUPERVISOR: "none",
  },
  teams: {
    ADMIN: "write",
    MANAGER: "none",
    SELLER: "none",
    SUPERVISOR: "none",
  },
  tracking: {
    ADMIN: "read",
    MANAGER: "read",
    SELLER: "none",
    SUPERVISOR: "none",
  },
  visits: {
    ADMIN: "read",
    MANAGER: "read",
    SELLER: "write",
    SUPERVISOR: "none",
  },
  reports: {
    ADMIN: "read",
    MANAGER: "read",
    SELLER: "none",
    SUPERVISOR: "none",
  },
  commissions: {
    ADMIN: "write",
    MANAGER: "none",
    SELLER: "none",
    SUPERVISOR: "none",
  },
  price_tables: {
    ADMIN: "write",
    MANAGER: "none",
    SELLER: "none",
    SUPERVISOR: "none",
  },
  permissions: {
    ADMIN: "read",
    MANAGER: "none",
    SELLER: "none",
    SUPERVISOR: "none",
  },
  audit: {
    ADMIN: "read",
    MANAGER: "none",
    SELLER: "none",
    SUPERVISOR: "none",
  },
};

export const PERMISSION_RESOURCE_LABELS: Record<PermissionResource, string> = {
  dashboard: "Início",
  products: "Produtos",
  stock: "Estoque",
  suppliers: "Fornecedores",
  customers: "Clientes",
  orders: "Pedidos / Vendas",
  sellers: "Vendedores",
  teams: "Equipes",
  tracking: "Rastreio",
  visits: "Visitas",
  reports: "Relatórios",
  commissions: "Comissões",
  price_tables: "Tabelas de preço",
  permissions: "Permissões (matriz)",
  audit: "Auditoria",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  SELLER: "Vendedor",
  SUPERVISOR: "Supervisor (não usado)",
};

export function getPermission(
  role: Role,
  resource: PermissionResource,
): PermissionLevel {
  return ROLE_PERMISSIONS[resource][role] ?? "none";
}

export function canRead(role: Role, resource: PermissionResource): boolean {
  const level = getPermission(role, resource);
  return level === "read" || level === "write";
}

export function canWrite(role: Role, resource: PermissionResource): boolean {
  return getPermission(role, resource) === "write";
}
