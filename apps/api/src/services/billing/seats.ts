import { prisma } from "../../db.js";
import { getOrgEntitlements } from "./entitlements.js";

export async function countPendingInvites(
  organizationId: string,
): Promise<number> {
  const now = new Date();
  return prisma.accountActivationToken.count({
    where: {
      purpose: "USER_INVITE",
      usedAt: null,
      expiresAt: { gt: now },
      user: { organizationId },
    },
  });
}

export async function countUsedSeats(organizationId: string): Promise<{
  usedSeats: number;
  activeUsers: number;
  pendingInvites: number;
  maxUsers: number | null;
}> {
  const [activeUsers, pendingInvites, ent] = await Promise.all([
    prisma.user.count({
      where: { organizationId, activatedAt: { not: null } },
    }),
    countPendingInvites(organizationId),
    getOrgEntitlements(organizationId),
  ]);
  return {
    usedSeats: activeUsers + pendingInvites,
    activeUsers,
    pendingInvites,
    maxUsers: ent.limits.maxUsers,
  };
}

export async function assertCanAddSeat(organizationId: string): Promise<void> {
  const { usedSeats, maxUsers } = await countUsedSeats(organizationId);
  if (maxUsers != null && usedSeats >= maxUsers) {
    throw Object.assign(
      new Error(
        `Seu plano permite até ${maxUsers} usuário(s). Remova um convite pendente ou altere o plano para adicionar outro vendedor.`,
      ),
      { code: "PLAN_USER_LIMIT", limit: maxUsers },
    );
  }
}
