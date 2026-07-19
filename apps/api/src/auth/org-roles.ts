import type { Prisma, Role } from "@prisma/client";
import type { FastifyReply } from "fastify";
import { prisma } from "../db.js";
import type { AccessPayload } from "./jwt.js";
import { canWrite } from "./permissions.js";

const STAFF_ROLES: Role[] = ["ADMIN", "MANAGER"];

/** GET paths (relative to /admin plugin) allowed for MANAGER. */
const MANAGER_GET_ALLOW = [
  /^\/$/,
  /^\/managers$/,
  /^\/sellers$/,
  /^\/seller-locations$/,
  /^\/seller-locations\/ws$/,
  /^\/customer-visits$/,
  /^\/sellers\/[^/]+\/location-history$/,
  /^\/orders$/,
  /^\/orders\/[^/]+$/,
  /^\/orders\/[^/]+\/pdf$/,
  /^\/orders\/[^/]+\/pdf-80mm$/,
  /^\/reports\/sales-by-supplier$/,
  /^\/reports\/scorecard$/,
  /^\/reports\/margin$/,
  /^\/reports\/commission-statement$/,
  /^\/reports\/stock-health$/,
  /^\/reports\/credit-aging$/,
  /^\/reports\/fiscal-reconciliation$/,
  /^\/reports\/visit-effectiveness$/,
  /^\/notifications$/,
  /^\/notifications\/unread-count$/,
  /^\/push-vapid-public-key$/,
] as const;

/** Write paths managers may use (inbox + push registration). */
const MANAGER_WRITE_ALLOW = [
  /^\/notifications\/[^/]+\/read$/,
  /^\/notifications\/read-all$/,
  /^\/push-devices$/,
] as const;

export function isManagerWriteAllowed(routePath: string): boolean {
  const path = routePath.split("?")[0] ?? routePath;
  return MANAGER_WRITE_ALLOW.some((re) => re.test(path));
}

/** GET paths allowed for team leader (seller with led team). */
const TEAM_LEADER_GET_ALLOW = [
  /^\/$/,
  /^\/sellers$/,
  /^\/seller-locations$/,
  /^\/seller-locations\/ws$/,
  /^\/customer-visits$/,
  /^\/sellers\/[^/]+\/location-history$/,
  /^\/orders$/,
  /^\/orders\/[^/]+$/,
  /^\/orders\/[^/]+\/pdf$/,
  /^\/orders\/[^/]+\/pdf-80mm$/,
  /^\/reports\/team-summary$/,
  /^\/reports\/sales-by-supplier$/,
  /^\/reports\/scorecard$/,
  /^\/reports\/visit-effectiveness$/,
] as const;

export function isOrgStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}

export function isTeamLeaderAuth(auth: AccessPayload): boolean {
  return auth.role === "SELLER" && !!auth.teamLeaderTeamId;
}

export function canAccessAdminPanel(auth: AccessPayload): boolean {
  return isOrgStaff(auth.role) || isTeamLeaderAuth(auth);
}

export function sellerScopeWhere(auth: AccessPayload): Prisma.SellerWhereInput {
  const base: Prisma.SellerWhereInput = { organizationId: auth.organizationId };
  if (auth.role === "MANAGER") {
    return { ...base, managerUserId: auth.sub };
  }
  if (isTeamLeaderAuth(auth)) {
    return { ...base, teamId: auth.teamLeaderTeamId! };
  }
  return base;
}

export function orderScopeWhere(auth: AccessPayload): Prisma.OrderWhereInput {
  const base: Prisma.OrderWhereInput = { organizationId: auth.organizationId };
  if (auth.role === "MANAGER") {
    return { ...base, seller: { managerUserId: auth.sub } };
  }
  if (isTeamLeaderAuth(auth)) {
    return { ...base, seller: { teamId: auth.teamLeaderTeamId! } };
  }
  return base;
}

export function isManagerGetAllowed(routePath: string): boolean {
  const path = routePath.split("?")[0] ?? routePath;
  return MANAGER_GET_ALLOW.some((re) => re.test(path));
}

export function isTeamLeaderGetAllowed(routePath: string): boolean {
  const path = routePath.split("?")[0] ?? routePath;
  return TEAM_LEADER_GET_ALLOW.some((re) => re.test(path));
}

export function requireOrgStaff(
  reply: FastifyReply,
  auth: AccessPayload | undefined,
): auth is AccessPayload {
  if (!auth) {
    void reply.status(401).send({ error: "Não autorizado" });
    return false;
  }
  if (!canAccessAdminPanel(auth)) {
    void reply.status(403).send({
      error: "Acesso restrito a administradores, gestores e líderes de equipe",
    });
    return false;
  }
  return true;
}

export function requireAdmin(
  reply: FastifyReply,
  auth: AccessPayload,
): boolean {
  if (!isAdmin(auth.role)) {
    void reply.status(403).send({ error: "Apenas administradores" });
    return false;
  }
  return true;
}

export async function assertSellerInScope(
  reply: FastifyReply,
  auth: AccessPayload,
  sellerId: string,
): Promise<boolean> {
  const row = await prisma.seller.findFirst({
    where: { id: sellerId, ...sellerScopeWhere(auth) },
    select: { id: true },
  });
  if (!row) {
    void reply.status(404).send({ error: "Vendedor não encontrado" });
    return false;
  }
  return true;
}

export async function validateManagerAssignment(
  organizationId: string,
  managerUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (managerUserId == null) return { ok: true };
  const mgr = await prisma.user.findFirst({
    where: { id: managerUserId, organizationId, role: "MANAGER" },
    select: { id: true },
  });
  if (!mgr) {
    return {
      ok: false,
      error:
        "Gestor inválido (deve ser utilizador MANAGER da mesma organização)",
    };
  }
  return { ok: true };
}

export async function teamMemberSellerIds(teamId: string): Promise<string[]> {
  const rows = await prisma.seller.findMany({
    where: { teamId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Invariante: Gestor não escreve estoque/produtos (sem perfil Seller). */
export function assertManagerHasNoStockWrite(): boolean {
  return (
    !canWrite("MANAGER", "stock") &&
    !canWrite("MANAGER", "products") &&
    canWrite("ADMIN", "stock")
  );
}
