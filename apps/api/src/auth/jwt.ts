import type { Role } from "@prisma/client";
import jwt from "jsonwebtoken";

function accessSecret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (!s) throw new Error("JWT_SECRET não definido");
  return s;
}

function refreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET?.trim();
  if (!s) throw new Error("JWT_REFRESH_SECRET não definido");
  return s;
}

export type AccessPayload = {
  sub: string;
  role: Role;
  organizationId: string;
  sellerId: string | null;
  teamLeaderTeamId?: string | null;
  type: "access";
};

export type RefreshPayload = {
  sub: string;
  type: "refresh";
};

export function signAccessToken(p: Omit<AccessPayload, "type">): string {
  return jwt.sign(
    { ...p, type: "access" } satisfies AccessPayload,
    accessSecret(),
    {
      expiresIn: "15m",
    },
  );
}

export function signRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: "refresh" } satisfies RefreshPayload,
    refreshSecret(),
    {
      expiresIn: "7d",
    },
  );
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, accessSecret()) as AccessPayload;
  if (decoded.type !== "access") throw new Error("Invalid token type");
  if (
    typeof decoded.organizationId !== "string" ||
    !decoded.organizationId.trim()
  ) {
    throw new Error("Invalid token organization");
  }
  if (typeof decoded.sub !== "string" || !decoded.sub.trim()) {
    throw new Error("Invalid token subject");
  }
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, refreshSecret()) as RefreshPayload;
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  return decoded;
}
