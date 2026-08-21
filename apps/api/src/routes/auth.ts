import rateLimit from "@fastify/rate-limit";
import {
    cnpjDigitsOnly,
    DEFAULT_PLAN_ID,
    isPlanId,
    isValidCnpj,
    type PlanId,
} from "@pedidos/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
} from "../auth/jwt.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { prisma } from "../db.js";
import {
    consumeActivationToken,
    consumePasswordResetToken,
    createActivationToken,
} from "../services/billing/account-activation.js";
import { sendPasswordResetEmail } from "../services/billing/activation-email.js";
import { getOrgEntitlements } from "../services/billing/entitlements.js";
import {
    isFakePaymentGatewayEnabled,
    isPaymentRequiredForSignup,
    resolvePaymentGateway,
} from "../services/billing/resolve-payment-gateway.js";
import { createCheckoutForRegisteredOrg } from "../services/billing/subscription-intent-service.js";
import { resolveUserForCompletedCheckout } from "../services/billing/claim-checkout-session.js";
import { syncOrgAccessFromSubscription } from "../services/billing/subscription-access.js";
import { fiscalConfigCreateData } from "../services/cnpj/fiscal-emitente.js";
import { lookupFiscalEmitente } from "../services/cnpj/lookup-fiscal-emitente.js";
import { ensureDefaultOrderSituations } from "../services/order-situations.js";
import { ensureDefaultPurchaseUnits } from "../services/purchase-units.js";
import {
    ensureOrgRolePermissions,
    getPermissionsMapForUser,
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
  organizationProfileId?: string | null;
  activatedAt?: Date | null;
  seller: {
    id: string;
    commissionPercent: import("@prisma/client").Prisma.Decimal;
  } | null;
}) {
  const leader = await resolveTeamLeaderContext(user.seller?.id ?? null);
  const permissions = await getPermissionsMapForUser(
    user.organizationId,
    user.role,
    user.organizationProfileId,
  );
  const subscription = await getOrgEntitlements(user.organizationId);
  const access = await syncOrgAccessFromSubscription(user.organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { name: true, displayName: true },
  });
  const organizationName =
    org?.displayName?.trim() || org?.name?.trim() || "";
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    matricula: user.matricula,
    role: user.role,
    organizationId: user.organizationId,
    organizationName,
    organizationProfileId: user.organizationProfileId ?? null,
    sellerId: user.seller?.id ?? null,
    commissionPercent: user.seller
      ? Number(user.seller.commissionPercent)
      : null,
    isTeamLeader: !!leader,
    teamId: leader?.teamId ?? null,
    teamName: leader?.teamName ?? null,
    permissions,
    subscription,
    accessStatus: access.accessStatus,
    orgAccessMessage: access.message,
    canUseApp: access.canUseApp,
    activatedAt: (user as { activatedAt?: Date | null }).activatedAt
      ? (user as { activatedAt: Date }).activatedAt.toISOString()
      : null,
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
  planId: z.string().trim().optional(),
  cnpj: z.string().trim().min(1, "CNPJ obrigatório"),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (req, reply) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const {
      organizationName,
      name,
      email,
      password,
      planId: rawPlanId,
      cnpj: rawCnpj,
    } = parsed.data;
    const cnpj = cnpjDigitsOnly(rawCnpj);
    if (!isValidCnpj(cnpj)) {
      return reply.status(400).send({ error: "CNPJ inválido" });
    }
    let planId: PlanId = DEFAULT_PLAN_ID;
    if (rawPlanId) {
      if (!isPlanId(rawPlanId)) {
        return reply.status(400).send({ error: "Plano inválido" });
      }
      planId = rawPlanId;
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return reply.status(409).send({ error: "Email já cadastrado" });

    const existingDoc = await prisma.organization.findFirst({
      where: { document: cnpj },
      select: { id: true },
    });
    if (existingDoc) {
      return reply.status(409).send({ error: "CNPJ já cadastrado" });
    }

    const emitente = await lookupFiscalEmitente(cnpj);

    const payRequired = isPaymentRequiredForSignup();
    if (payRequired && !resolvePaymentGateway()) {
      return reply.status(503).send({
        error: "Pagamentos indisponíveis no momento. Tente novamente em breve.",
        code: "ASAAS_NOT_CONFIGURED",
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName,
          displayName: organizationName,
          accessStatus: payRequired ? "PENDING_PAYMENT" : "ACTIVE",
          document: cnpj,
          cnpj,
        },
      });
      await tx.organizationFiscalConfig.create({
        data: fiscalConfigCreateData(org.id, emitente),
      });
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);
      const provider = !payRequired
        ? "none"
        : isFakePaymentGatewayEnabled()
          ? "fake"
          : "asaas";
      await tx.organizationSubscription.create({
        data: {
          organizationId: org.id,
          planId,
          status: payRequired ? "INCOMPLETE" : "TRIAL",
          provider,
          currentPeriodStart: now,
          currentPeriodEnd: payRequired ? null : trialEnd,
        },
      });
      return tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: "ADMIN",
          organizationId: org.id,
          activatedAt: new Date(),
        },
        include: { seller: true },
      });
    });

    await ensureOrgRolePermissions(user.organizationId);
    await ensureDefaultOrderSituations(user.organizationId);
    await ensureDefaultPurchaseUnits(user.organizationId);

    let checkout: { intentId: string; checkoutUrl: string | null } | null = null;
    let checkoutError: string | null = null;
    if (payRequired) {
      try {
        checkout = await createCheckoutForRegisteredOrg({
          organizationId: user.organizationId,
          ownerUserId: user.id,
          planId,
          companyName: organizationName,
          adminName: name,
          email,
          document: cnpj,
          lockAccessUntilPaid: true,
        });
      } catch (err) {
        checkoutError =
          err instanceof Error ? err.message : "Falha ao preparar pagamento";
      }
    }

    const accessToken = signAccessToken(await accessPayloadForUser(user));
    const refreshToken = signRefreshToken(user.id);
    const me = await userResponseForMe(user);

    return {
      accessToken,
      refreshToken,
      user: me,
      requiresPayment: payRequired,
      intentId: checkout?.intentId ?? null,
      checkoutUrl: checkout?.checkoutUrl ?? null,
      checkoutError,
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

    if (!user.activatedAt) {
      return reply.status(403).send({
        error:
          "Conta ainda não ativada. Use o link enviado por e-mail para criar sua senha.",
        code: "ACCOUNT_NOT_ACTIVATED",
      });
    }

    const access = await syncOrgAccessFromSubscription(user.organizationId);
    if (!access.canUseApp && user.role !== "ADMIN") {
      return reply.status(403).send({
        error:
          access.message ||
          "O acesso desta organização está temporariamente indisponível.",
        code: "ORG_ACCESS_BLOCKED",
        accessStatus: access.accessStatus,
      });
    }
    if (access.pendingPayment && user.role !== "ADMIN") {
      return reply.status(403).send({
        error: access.message || "Pagamento pendente.",
        code: "ORG_PENDING_PAYMENT",
        accessStatus: access.accessStatus,
      });
    }
    if (
      access.accessStatus === "SUSPENDED" ||
      access.accessStatus === "CANCELED"
    ) {
      return reply.status(403).send({
        error: access.message || "Organização suspensa.",
        code: "ORG_ACCESS_BLOCKED",
        accessStatus: access.accessStatus,
      });
    }

    await ensureOrgRolePermissions(user.organizationId);
    await ensureDefaultOrderSituations(user.organizationId);
    await ensureDefaultPurchaseUnits(user.organizationId);

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

  app.post("/complete-payment", async (req, reply) => {
    const body = z.object({ intentId: z.string().min(1) }).safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "Dados inválidos", details: body.error.flatten() });
    }
    try {
      const user = await resolveUserForCompletedCheckout(body.data.intentId);
      await ensureOrgRolePermissions(user.organizationId);
      await ensureDefaultOrderSituations(user.organizationId);
      await ensureDefaultPurchaseUnits(user.organizationId);
      const accessToken = signAccessToken(await accessPayloadForUser(user));
      const refreshToken = signRefreshToken(user.id);
      return {
        accessToken,
        refreshToken,
        user: await userResponseForMe(user),
      };
    } catch (err) {
      const e = err as { message?: string; code?: string; http?: number };
      return reply.status(e.http ?? 500).send({
        error: e.message || "Falha ao concluir pagamento",
        code: e.code,
      });
    }
  });

  app.post("/activate-account", async (req, reply) => {
    const body = z
      .object({
        token: z.string().min(10),
        password: z.string().min(6, "Senha com pelo menos 6 caracteres"),
      })
      .safeParse(req.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "Dados inválidos", details: body.error.flatten() });
    }

    try {
      const result = await consumeActivationToken({
        rawToken: body.data.token,
        password: body.data.password,
      });
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        include: { seller: true },
      });
      if (!user) {
        return reply.status(404).send({ error: "Usuário não encontrado" });
      }

      const access = await syncOrgAccessFromSubscription(user.organizationId);
      if (!access.canUseApp && access.pendingPayment) {
        return {
          ok: true,
          message: "Senha definida. Aguarde a confirmação do pagamento.",
          needsLogin: true,
        };
      }

      await ensureOrgRolePermissions(user.organizationId);
      const accessToken = signAccessToken(await accessPayloadForUser(user));
      const refreshToken = signRefreshToken(user.id);
      return {
        ok: true,
        accessToken,
        refreshToken,
        user: await userResponseForMe(user),
      };
    } catch (err) {
      const code = (err as { code?: string }).code;
      const status =
        code === "ACTIVATION_TOKEN_EXPIRED" ||
        code === "ACTIVATION_TOKEN_INVALID"
          ? 400
          : 500;
      return reply.status(status).send({
        error: err instanceof Error ? err.message : "Falha na ativação",
        code,
      });
    }
  });

  /** Forgot / reset — rate-limit por IP; resposta genérica no forgot. */
  await app.register(async (limited) => {
    await limited.register(rateLimit, {
      max: 8,
      timeWindow: "1 minute",
      keyGenerator: (req) => req.ip,
    });

    const forgotBody = z.object({
      email: z
        .string()
        .email()
        .transform((e) => e.trim().toLowerCase()),
    });

    const resetBody = z.object({
      token: z.string().min(10),
      password: z.string().min(6, "Senha com pelo menos 6 caracteres"),
    });

    const FORGOT_OK = {
      ok: true as const,
      message:
        "Se existir uma conta ativa com este e-mail, enviaremos instruções para redefinir a senha.",
    };

    limited.post("/forgot-password", async (req, reply) => {
      const parsed = forgotBody.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Dados inválidos", details: parsed.error.flatten() });
      }

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });

      // Não vazar existência. Conta pendente recebe o convite de ativação de novo.
      if (user) {
        try {
          if (!user.activatedAt) {
            const { sendInviteForExistingUser } =
              await import("../services/billing/activation-email.js");
            const emailResult = await sendInviteForExistingUser(user.id);
            if (!emailResult.sent) {
              app.log.warn(
                { email: user.email, reason: emailResult.reason },
                "forgot-password: convite de ativação não enviado",
              );
            }
          } else {
            const { rawToken, expiresAt } = await createActivationToken(
              user.id,
              "PASSWORD_RESET",
            );
            const emailResult = await sendPasswordResetEmail({
              to: user.email,
              name: user.name,
              rawToken,
              expiresAt,
            });
            if (!emailResult.sent) {
              app.log.warn(
                { email: user.email, reason: emailResult.reason },
                "forgot-password: e-mail não enviado",
              );
            }
          }
        } catch (err) {
          app.log.warn(
            { err, email: parsed.data.email },
            "forgot-password: falha ao criar/enviar reset",
          );
        }
      }

      return reply.send(FORGOT_OK);
    });

    limited.post("/reset-password", async (req, reply) => {
      const parsed = resetBody.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Dados inválidos", details: parsed.error.flatten() });
      }

      try {
        await consumePasswordResetToken({
          rawToken: parsed.data.token,
          password: parsed.data.password,
        });
        return {
          ok: true,
          message: "Senha atualizada. Você já pode entrar com a nova senha.",
        };
      } catch (err) {
        const code = (err as { code?: string }).code;
        const status =
          code === "RESET_TOKEN_EXPIRED" ||
          code === "RESET_TOKEN_INVALID" ||
          code === "ACCOUNT_NOT_ACTIVATED"
            ? 400
            : 500;
        return reply.status(status).send({
          error:
            err instanceof Error ? err.message : "Falha ao redefinir senha",
          code,
        });
      }
    });
  });
};
