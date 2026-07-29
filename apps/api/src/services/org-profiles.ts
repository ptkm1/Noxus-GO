import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import {
  isPermissionLevel,
  isPermissionResource,
  PERMISSION_RESOURCES,
  type PermissionLevel,
  type PermissionResource,
} from "../auth/permissions.js";
import { prisma } from "../db.js";

/** Papel técnico interno do User quando um perfil custom é atribuído (não exposto na UI). */
const DEFAULT_STAFF_BASE_ROLE: Role = "MANAGER";

export class OrgProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrgProfileError";
  }
}

function makeProfileKey(): string {
  return `custom_${randomBytes(6).toString("hex")}`;
}

export type OrgProfileDto = {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  baseRole: Role;
  hasSellerProfile: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
};

function serializeProfile(p: {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  baseRole: Role;
  hasSellerProfile: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { users: number };
}): OrgProfileDto {
  return {
    id: p.id,
    name: p.name,
    key: p.key,
    enabled: p.enabled,
    baseRole: p.baseRole,
    hasSellerProfile: p.hasSellerProfile,
    userCount: p._count?.users ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function listOrgProfiles(
  organizationId: string,
): Promise<OrgProfileDto[]> {
  const rows = await prisma.organizationProfile.findMany({
    where: { organizationId },
    include: { _count: { select: { users: true } } },
    orderBy: [{ name: "asc" }],
  });
  return rows.map(serializeProfile);
}

export async function createOrgProfile(
  organizationId: string,
  input: { name: string },
): Promise<OrgProfileDto> {
  const name = input.name.trim();
  if (!name) throw new OrgProfileError("Nome do perfil é obrigatório");

  const key = makeProfileKey();

  // Perfil independente: começa sem acesso; o admin define tudo na matriz.
  const permissionRows = PERMISSION_RESOURCES.map((resource) => ({
    resource,
    level: "none" as const,
  }));

  const created = await prisma.organizationProfile.create({
    data: {
      organizationId,
      name,
      key,
      enabled: true,
      baseRole: DEFAULT_STAFF_BASE_ROLE,
      hasSellerProfile: false,
      permissions: {
        create: permissionRows,
      },
    },
    include: { _count: { select: { users: true } } },
  });

  return serializeProfile(created);
}

export async function updateOrgProfile(
  organizationId: string,
  profileId: string,
  input: {
    name?: string;
    enabled?: boolean;
    hasSellerProfile?: boolean;
  },
): Promise<OrgProfileDto> {
  const existing = await prisma.organizationProfile.findFirst({
    where: { id: profileId, organizationId },
  });
  if (!existing) throw new OrgProfileError("Perfil não encontrado");

  const data: {
    name?: string;
    enabled?: boolean;
    hasSellerProfile?: boolean;
  } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new OrgProfileError("Nome do perfil é obrigatório");
    data.name = name;
  }
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.hasSellerProfile !== undefined) {
    data.hasSellerProfile = input.hasSellerProfile;
  }

  const updated = await prisma.organizationProfile.update({
    where: { id: profileId },
    data,
    include: { _count: { select: { users: true } } },
  });

  return serializeProfile(updated);
}

export async function deleteOrgProfile(
  organizationId: string,
  profileId: string,
): Promise<void> {
  const existing = await prisma.organizationProfile.findFirst({
    where: { id: profileId, organizationId },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) throw new OrgProfileError("Perfil não encontrado");
  if (existing._count.users > 0) {
    throw new OrgProfileError(
      "Não é possível excluir: há usuários atribuídos a este perfil",
    );
  }

  await prisma.organizationProfile.delete({ where: { id: profileId } });
}

export async function getProfilePermissionsMap(
  profileId: string,
): Promise<Record<PermissionResource, PermissionLevel> | null> {
  const profile = await prisma.organizationProfile.findUnique({
    where: { id: profileId },
    select: {
      enabled: true,
      permissions: { select: { resource: true, level: true } },
    },
  });
  if (!profile || !profile.enabled) return null;

  const map = {} as Record<PermissionResource, PermissionLevel>;
  for (const resource of PERMISSION_RESOURCES) {
    map[resource] = "none";
  }
  for (const row of profile.permissions) {
    if (!isPermissionResource(row.resource)) continue;
    if (!isPermissionLevel(row.level)) continue;
    map[row.resource] = row.level;
  }
  return map;
}

export async function upsertProfilePermission(
  profileId: string,
  resource: PermissionResource,
  level: PermissionLevel,
): Promise<void> {
  await prisma.organizationProfilePermission.upsert({
    where: {
      profileId_resource: { profileId, resource },
    },
    create: { profileId, resource, level },
    update: { level },
  });
}

export function isCustomProfileKey(value: string): boolean {
  return value.startsWith("custom_");
}
