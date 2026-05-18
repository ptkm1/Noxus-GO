import type { FastifyReply, FastifyRequest } from "fastify";
import type { AccessPayload } from "../auth/jwt.js";

export function getAuth(req: FastifyRequest, reply: FastifyReply): AccessPayload | null {
  if (!req.auth) {
    void reply.status(401).send({ error: "Não autorizado" });
    return null;
  }
  return req.auth;
}

export function requireAdmin(auth: AccessPayload, reply: FastifyReply): boolean {
  if (auth.role !== "ADMIN") {
    void reply.status(403).send({ error: "Apenas administradores" });
    return false;
  }
  return true;
}

export function requireSeller(auth: AccessPayload, reply: FastifyReply): boolean {
  if (auth.role !== "SELLER" || !auth.sellerId) {
    void reply.status(403).send({ error: "Apenas vendedores" });
    return false;
  }
  return true;
}
