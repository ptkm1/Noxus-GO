import { prisma } from "../db.js";

export class SalesTeamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesTeamError";
  }
}

const teamInclude = {
  leaderSeller: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  members: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  _count: { select: { members: true } },
} as const;

export async function resolveTeamLeaderTeamId(
  sellerId: string | null | undefined,
): Promise<string | null> {
  if (!sellerId) return null;
  const team = await prisma.salesTeam.findFirst({
    where: { leaderSellerId: sellerId },
    select: { id: true },
  });
  return team?.id ?? null;
}

export async function resolveTeamLeaderContext(
  sellerId: string | null | undefined,
) {
  if (!sellerId) return null;
  const team = await prisma.salesTeam.findFirst({
    where: { leaderSellerId: sellerId },
    select: { id: true, name: true },
  });
  if (!team) return null;
  return { teamId: team.id, teamName: team.name, isTeamLeader: true as const };
}

async function validateTeamMembers(
  organizationId: string,
  leaderSellerId: string,
  memberSellerIds: string[],
  excludeTeamId?: string,
) {
  const uniqueIds = [...new Set(memberSellerIds)];
  if (!uniqueIds.includes(leaderSellerId)) {
    throw new SalesTeamError("O líder deve fazer parte da equipe.");
  }

  const sellers = await prisma.seller.findMany({
    where: { id: { in: uniqueIds }, organizationId, active: true },
    select: { id: true, teamId: true, user: { select: { name: true } } },
  });

  if (sellers.length !== uniqueIds.length) {
    throw new SalesTeamError(
      "Um ou mais vendedores são inválidos ou inativos.",
    );
  }

  for (const s of sellers) {
    if (s.teamId && s.teamId !== excludeTeamId) {
      throw new SalesTeamError(
        `O vendedor ${s.user.name} já pertence a outra equipe.`,
      );
    }
  }

  const leaderAlreadyLeads = await prisma.salesTeam.findFirst({
    where: {
      leaderSellerId,
      ...(excludeTeamId ? { id: { not: excludeTeamId } } : {}),
    },
    select: { id: true },
  });
  if (leaderAlreadyLeads) {
    throw new SalesTeamError("Este vendedor já é líder de outra equipe.");
  }

  return uniqueIds;
}

export async function listSalesTeams(organizationId: string) {
  return prisma.salesTeam.findMany({
    where: { organizationId },
    include: teamInclude,
    orderBy: { name: "asc" },
  });
}

export async function getSalesTeam(organizationId: string, id: string) {
  return prisma.salesTeam.findFirst({
    where: { id, organizationId },
    include: teamInclude,
  });
}

export async function createSalesTeam(
  organizationId: string,
  input: { name: string; leaderSellerId: string; memberSellerIds: string[] },
) {
  const name = input.name.trim();
  if (!name) throw new SalesTeamError("Informe o nome da equipe.");

  const memberIds = await validateTeamMembers(
    organizationId,
    input.leaderSellerId,
    input.memberSellerIds,
  );

  return prisma.$transaction(async (tx) => {
    const team = await tx.salesTeam.create({
      data: {
        name,
        organizationId,
        leaderSellerId: input.leaderSellerId,
      },
    });

    await tx.seller.updateMany({
      where: { id: { in: memberIds }, organizationId },
      data: { teamId: team.id },
    });

    return tx.salesTeam.findUniqueOrThrow({
      where: { id: team.id },
      include: teamInclude,
    });
  });
}

export async function updateSalesTeam(
  organizationId: string,
  id: string,
  input: { name?: string; leaderSellerId?: string; memberSellerIds?: string[] },
) {
  const existing = await prisma.salesTeam.findFirst({
    where: { id, organizationId },
    include: { members: { select: { id: true } } },
  });
  if (!existing) return null;

  const leaderSellerId = input.leaderSellerId ?? existing.leaderSellerId;
  const memberIds = input.memberSellerIds ?? existing.members.map((m) => m.id);

  if (input.name !== undefined && !input.name.trim()) {
    throw new SalesTeamError("Informe o nome da equipe.");
  }

  const validatedMemberIds = await validateTeamMembers(
    organizationId,
    leaderSellerId,
    memberIds,
    id,
  );

  return prisma.$transaction(async (tx) => {
    await tx.salesTeam.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.leaderSellerId !== undefined ? { leaderSellerId } : {}),
      },
    });

    await tx.seller.updateMany({
      where: { organizationId, teamId: id, id: { notIn: validatedMemberIds } },
      data: { teamId: null },
    });

    await tx.seller.updateMany({
      where: { id: { in: validatedMemberIds }, organizationId },
      data: { teamId: id },
    });

    return tx.salesTeam.findUniqueOrThrow({
      where: { id },
      include: teamInclude,
    });
  });
}

export async function deleteSalesTeam(organizationId: string, id: string) {
  const existing = await prisma.salesTeam.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.$transaction(async (tx) => {
    await tx.seller.updateMany({
      where: { organizationId, teamId: id },
      data: { teamId: null },
    });
    await tx.salesTeam.delete({ where: { id } });
  });

  return true;
}

export function serializeSalesTeam(
  team: Awaited<ReturnType<typeof listSalesTeams>>[number],
) {
  return {
    id: team.id,
    name: team.name,
    leaderSellerId: team.leaderSellerId,
    leader: {
      id: team.leaderSeller.id,
      name: team.leaderSeller.user.name,
      email: team.leaderSeller.user.email,
    },
    memberCount: team._count.members,
    members: team.members.map((m) => ({
      id: m.id,
      name: m.user.name,
      email: m.user.email,
      isLeader: m.id === team.leaderSellerId,
    })),
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}
