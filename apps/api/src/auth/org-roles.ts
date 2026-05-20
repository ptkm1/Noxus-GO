import type { FastifyReply } from "fastify";
import type { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { AccessPayload } from "./jwt.js";
import { prisma } from "../db.js";

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
] as const;

export function isOrgStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}

export function sellerScopeWhere(auth: AccessPayload): Prisma.SellerWhereInput {
  const base: Prisma.SellerWhereInput = { organizationId: auth.organizationId };
  if (auth.role === "MANAGER") {
    return { ...base, managerUserId: auth.sub };
  }
  return base;
}

export function isManagerGetAllowed(routePath: string): boolean {
  const path = routePath.split("?")[0] ?? routePath;
  return MANAGER_GET_ALLOW.some((re) => re.test(path));
}

export function requireOrgStaff(reply: FastifyReply, auth: AccessPayload | undefined): auth is AccessPayload {
  if (!auth) {
    void reply.status(401).send({ error: "Não autorizado" });
    return false;
  }
  if (!isOrgStaff(auth.role)) {
    void reply.status(403).send({ error: "Acesso restrito a administradores e gestores" });
    return false;
  }
  return true;
}

export function requireAdmin(reply: FastifyReply, auth: AccessPayload): boolean {
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
  if (!mgr) return { ok: false, error: "Gestor inválido (deve ser utilizador MANAGER da mesma organização)" };
  return { ok: true };
}
