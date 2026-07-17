import type { User } from "@/auth/AuthContext";
import type { Role } from "@pedidos/shared";

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
