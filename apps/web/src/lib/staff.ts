import type { Role } from "@pedidos/shared";

const WEB_STAFF: Role[] = ["ADMIN", "MANAGER"];

export function isWebStaff(role: Role | undefined): boolean {
  return role != null && WEB_STAFF.includes(role);
}

export function isWebAdmin(role: Role | undefined): boolean {
  return role === "ADMIN";
}
