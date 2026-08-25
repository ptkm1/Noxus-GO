import type { User } from "@/auth/AuthContext";
import { ROLE_LABELS, type Role } from "@pedidos/shared";

const WEB_STAFF_ROLES: Role[] = ["ADMIN", "MANAGER"];

export function isWebTeamLeader(
  user: Pick<User, "isTeamLeader"> | null | undefined,
): boolean {
  return !!user?.isTeamLeader;
}

export function isWebStaff(
  user: Pick<User, "role" | "isTeamLeader"> | null | undefined,
): boolean {
  if (!user) return false;
  return WEB_STAFF_ROLES.includes(user.role) || isWebTeamLeader(user);
}

export function isWebAdmin(role: Role | undefined): boolean {
  return role === "ADMIN";
}

export function isWebManager(role: Role | undefined): boolean {
  return role === "MANAGER";
}

/** Rótulo de papel para UI do staff (considera líder de equipe). */
export function staffRoleLabel(
  user: Pick<User, "role" | "isTeamLeader"> | null | undefined,
): string {
  if (!user) return "";
  if (user.role === "MANAGER") return "Gestor";
  if (isWebTeamLeader(user)) return "Líder de equipe";
  if (user.role === "ADMIN") return "Administrador";
  return ROLE_LABELS[user.role] ?? user.role;
}

/** Iniciais a partir do nome (até 2 letras). */
export function userInitials(name: string | null | undefined): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}
