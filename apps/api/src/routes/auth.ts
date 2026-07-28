import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../auth/jwt.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { prisma } from "../db.js";
import { getOrgEntitlements } from "../services/billing/entitlements.js";
import {
  ensureOrgRolePermissions,
  getRolePermissionsMap,
} from "../services/role-permissions.js";
import {
  resolveTeamLeaderContext,
  resolveTeamLeaderTeamId,
} from "../services/sales-teams.js";
import { getAuth } from "../util/guards.js";

async function accessPayloadForUser(user: {
  id: string;
  role: import("@prisma/client").Role;
  organizationId: string;
  seller: { id: string } | null;
}) {
  const teamLeaderTeamId = await resolveTeamLeaderTeamId(
    user.seller?.id ?? null,
  );
  return {
    sub: user.id,
    role: user.role,
    organizationId: user.organizationId,
    sellerId: user.seller?.id ?? null,
    teamLeaderTeamId,
  };
}

async function userResponseForMe(user: {
  id: string;
  email: string;
  name: string;
  matricula: string | null;
  role: import("@prisma/client").Role;
  organizationId: string;
  seller: {
    id: string;
    commissionPercent: import("@prisma/client").Prisma.Decimal;
  } | null;
}) {
  const leader = await resolveTeamLeaderContext(user.seller?.id ?? null);
  const permissions = await getRolePermissionsMap(
    user.organizationId,
    user.role,
  );
  const subscription = await getOrgEntitlements(user.organizationId);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    matricula: user.matricula,
    role: user.role,
    organizationId: user.organizationId,
    sellerId: user.seller?.id ?? null,
    commissionPercent: user.seller
      ? Number(user.seller.commissionPercent)
      : null,
    isTeamLeader: !!leader,
    teamId: leader?.teamId ?? null,
    teamName: leader?.teamName ?? null,
    permissions,
    subscription,
  };
}

const loginBody = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.trim().toLowerCase()),
  password: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Senha obrigatória")),
});

const refreshBody = z.object({
  refreshToken: z.string().min(1),
});

const registerBody = z.object({
  organizationName: z.string().trim().min(1, "Nome da empresa obrigatório"),
  name: z.string().trim().min(1, "Nome obrigatório"),
  email: z
    .string()
    .email()
    .transform((e) => e.trim().toLowerCase()),
  password: z.string().min(6, "Senha com pelo menos 6 caracteres"),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (req, reply) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const { organizationName, name, email, password } = parsed.data;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return reply.status(409).send({ error: "Email já cadastrado" });

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: organizationName, displayName: organizationName },
      });
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);
      await tx.organizationSubscription.create({
        data: {
          organizationId: org.id,
          planId: "starter",
          status: "TRIAL",
          provider: "none",
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
        },
      });
      return tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: "ADMIN",
          organizationId: org.id,
        },
        include: { seller: true },
      });
    });

    await ensureOrgRolePermissions(user.organizationId);

    const accessToken = signAccessToken(await accessPayloadForUser(user));
    const refreshToken = signRefreshToken(user.id);
    const me = await userResponseForMe(user);

    return {
      accessToken,
      refreshToken,
      user: me,
    };
  });

  app.post("/login", async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      const body = req.body;
      app.log.warn(
        {
          zod: parsed.error.flatten(),
          bodyType: body === null ? "null" : typeof body,
          bodyKeys:
            body && typeof body === "object" && !Array.isArray(body)
              ? Object.keys(body as object)
              : [],
        },
        "login: JSON inválido ou campos em falta (esperado email + password)",
      );
      return reply
        .status(400)
        .send({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const emailNorm = parsed.data.email;
    const plainPassword = parsed.data.password;

    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
      include: { seller: true },
    });

    const passwordOk = user
      ? await verifyPassword(plainPassword, user.passwordHash)
      : false;

    if (!user || !passwordOk) {
      app.log.warn(
        {
          email: emailNorm,
          userFound: !!user,
          passwordCheck: user ? passwordOk : null,
          hashLooksLikeBcrypt: user?.passwordHash?.startsWith("$2") ?? null,
        },
        user
          ? "login: senha incorreta"
          : "login: email não existe na base — corre pnpm db:seed na raiz do monorepo",
      );
      return reply.status(401).send({ error: "Email ou senha incorretos" });
    }

    const accessToken = signAccessToken(await accessPayloadForUser(user));
    const refreshToken = signRefreshToken(user.id);
    const me = await userResponseForMe(user);

    return {
      accessToken,
      refreshToken,
      user: me,
    };
  });

  app.post("/refresh", async (req, reply) => {
    const parsed = refreshBody.safeParse(req.body);
    if (!parsed.success)
      return reply.status(400).send({ error: "Dados inválidos" });

    let payload;
    try {
      payload = verifyRefreshToken(parsed.data.refreshToken);
    } catch {
      return reply.status(401).send({ error: "Refresh inválido" });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { seller: true },
    });
    if (!user)
      return reply.status(401).send({ error: "Usuário não encontrado" });

    const accessToken = signAccessToken(await accessPayloadForUser(user));

    return { accessToken };
  });

  app.get("/me", async (req, reply) => {
    const auth = getAuth(req, reply);
    if (!auth) return;

    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      include: { seller: true },
    });
    if (!user)
      return reply.status(404).send({ error: "Usuário não encontrado" });

    return userResponseForMe(user);
  });
};
