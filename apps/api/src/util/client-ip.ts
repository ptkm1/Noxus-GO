import type { FastifyRequest } from "fastify";

const PRIVATE_IP =
  /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc00:|fd)/;

function normalizeIp(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice(7);
  }
  return trimmed;
}

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP.test(ip);
}

/** IP do cliente para `remoteIp` do Asaas (nunca usar IP do servidor). */
export function resolveClientRemoteIp(req: FastifyRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const chain =
    typeof forwarded === "string"
      ? forwarded.split(",").map((s) => normalizeIp(s)).filter(Boolean)
      : [];

  for (const ip of chain) {
    if (ip && !isPrivateIp(ip)) return ip;
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") {
    const ip = normalizeIp(realIp);
    if (ip && !isPrivateIp(ip)) return ip;
  }

  const socketIp = normalizeIp(req.ip || req.socket.remoteAddress || "");
  if (socketIp && !isPrivateIp(socketIp)) return socketIp;

  if (socketIp) return socketIp;
  return "127.0.0.1";
}
