import type { AccountActivationPurpose, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "../../auth/password.js";
import { prisma } from "../../db.js";

/** Ativação / convite: 48h. */
const ACTIVATION_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
/** Reset de senha: 1h (mais curto por segurança). */
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const ACTIVATION_PURPOSES: AccountActivationPurpose[] = [
  "OWNER_ACTIVATION",
  "USER_INVITE",
];

export function hashActivationToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateActivationTokenRaw(): string {
  return randomBytes(32).toString("base64url");
}

function ttlForPurpose(purpose: AccountActivationPurpose): number {
  return purpose === "PASSWORD_RESET"
    ? PASSWORD_RESET_TOKEN_TTL_MS
    : ACTIVATION_TOKEN_TTL_MS;
}

export async function createActivationToken(
  userId: string,
  purpose: AccountActivationPurpose,
  tx?: Prisma.TransactionClient,
): Promise<{ rawToken: string; expiresAt: Date }> {
  const db = tx ?? prisma;
  const rawToken = generateActivationTokenRaw();
  const tokenHash = hashActivationToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlForPurpose(purpose));

  await db.accountActivationToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  await db.accountActivationToken.create({
    data: { userId, purpose, tokenHash, expiresAt },
  });

  return { rawToken, expiresAt };
}

export async function consumeActivationToken(params: {
  rawToken: string;
  password: string;
  purpose?: AccountActivationPurpose;
}): Promise<{ userId: string; organizationId: string; email: string }> {
  const tokenHash = hashActivationToken(params.rawToken);
  const row = await prisma.accountActivationToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      purpose: params.purpose
        ? params.purpose
        : { in: ACTIVATION_PURPOSES },
    },
    include: { user: true },
  });

  if (!row) {
    throw Object.assign(new Error("Token inválido ou já utilizado"), {
      code: "ACTIVATION_TOKEN_INVALID",
    });
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw Object.assign(new Error("Token expirado"), {
      code: "ACTIVATION_TOKEN_EXPIRED",
    });
  }

  const passwordHash = await hashPassword(params.password);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.accountActivationToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    });
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, activatedAt: now },
    });
  });

  return {
    userId: row.userId,
    organizationId: row.user.organizationId,
    email: row.user.email,
  };
}

/**
 * Consome token PASSWORD_RESET: atualiza hash e invalida resets pendentes.
 * Não altera activatedAt (conta já deve estar ativa).
 */
export async function consumePasswordResetToken(params: {
  rawToken: string;
  password: string;
}): Promise<{ userId: string; organizationId: string; email: string }> {
  const tokenHash = hashActivationToken(params.rawToken);
  const row = await prisma.accountActivationToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      purpose: "PASSWORD_RESET",
    },
    include: { user: true },
  });

  if (!row) {
    throw Object.assign(new Error("Token inválido ou já utilizado"), {
      code: "RESET_TOKEN_INVALID",
    });
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw Object.assign(new Error("Token expirado"), {
      code: "RESET_TOKEN_EXPIRED",
    });
  }
  if (!row.user.activatedAt) {
    throw Object.assign(
      new Error(
        "Conta ainda não ativada. Use o link de ativação enviado por e-mail.",
      ),
      { code: "ACCOUNT_NOT_ACTIVATED" },
    );
  }

  const passwordHash = await hashPassword(params.password);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.accountActivationToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    });
    await tx.accountActivationToken.updateMany({
      where: {
        userId: row.userId,
        purpose: "PASSWORD_RESET",
        usedAt: null,
        id: { not: row.id },
      },
      data: { usedAt: now },
    });
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    });
  });

  return {
    userId: row.userId,
    organizationId: row.user.organizationId,
    email: row.user.email,
  };
}

/** Hash aleatório inutilizável até o usuário definir senha. */
export async function unusablePasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString("hex"));
}
