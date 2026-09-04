import type { Prisma, Role } from "@prisma/client";
import type { FastifyReply } from "fastify";
import type { AccessPayload } from "../auth/jwt.js";

/** Papéis que podem usar o app mobile (rotas /seller). */
export function isMobileAppRole(role: Role): boolean {
  return role === "SELLER" || role === "ADMIN";
}

export function canAccessSellerApi(auth: AccessPayload): boolean {
  if (!auth.organizationId?.trim()) return false;
  if (auth.role === "ADMIN") return true;
  return auth.role === "SELLER" && Boolean(auth.sellerId);
}

/** Pedidos: admin vê a org inteira; vendedor só a carteira dele. */
export function mobileOrderWhere(
  auth: AccessPayload,
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    organizationId: auth.organizationId,
  };
  if (auth.role !== "ADMIN" && auth.sellerId) {
    where.sellerId = auth.sellerId;
  }
  return where;
}

/**
 * Operações que exigem perfil de vendedor (criar venda, visita, GPS, etc.).
 * Admin pode consultar; não atua como seller nestas rotas.
 */
export function requireSellerActor(
  auth: AccessPayload,
  reply: FastifyReply,
): string | null {
  if (auth.role === "SELLER" && auth.sellerId) return auth.sellerId;
  void reply.status(403).send({
    error:
      auth.role === "ADMIN"
        ? "Administradores consultam vendas neste app; lançamentos de vendedor usam o painel web ou uma conta de vendedor."
        : "Apenas vendedores",
  });
  return null;
}
