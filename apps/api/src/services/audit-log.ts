import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

type AuditInput = {
  organizationId: string;
  userId?: string | null;
  userMatricula?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(
  input: AuditInput,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      userMatricula: input.userMatricula ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function resolveUserMatricula(
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { matricula: true },
  });
  return user?.matricula ?? null;
}
