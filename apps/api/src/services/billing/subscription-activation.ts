import { DEFAULT_PLAN_ID, getPlanDefinition } from "@pedidos/shared";
import { prisma } from "../../db.js";
import { createActivationToken } from "./account-activation.js";
import { sendOwnerActivationEmail } from "./activation-email.js";
import { gracePeriodEndFromNow } from "./subscription-access.js";

/**
 * Ativa empresa/assinatura após pagamento confirmado.
 * Idempotente: se já COMPLETED/ACTIVE, não reenvia e-mail.
 */
export async function activateOrganizationFromPayment(params: {
  intentId?: string | null;
  organizationId?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  providerCheckoutId?: string | null;
  currentPeriodEnd?: Date | null;
}): Promise<{ activated: boolean; alreadyActive: boolean }> {
  let intent = params.intentId
    ? await prisma.checkoutIntent.findUnique({ where: { id: params.intentId } })
    : null;

  if (!intent && params.providerCheckoutId) {
    intent = await prisma.checkoutIntent.findFirst({
      where: { providerCheckoutId: params.providerCheckoutId },
    });
  }
  if (!intent && params.providerSubscriptionId) {
    intent = await prisma.checkoutIntent.findFirst({
      where: { providerSubscriptionId: params.providerSubscriptionId },
    });
  }
  if (!intent && params.organizationId) {
    intent = await prisma.checkoutIntent.findFirst({
      where: { organizationId: params.organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  const organizationId =
    intent?.organizationId || params.organizationId || null;
  if (!organizationId) {
    return { activated: false, alreadyActive: false };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { accessStatus: true, name: true },
  });
  if (!org) return { activated: false, alreadyActive: false };

  if (org.accessStatus === "ACTIVE" && intent?.status === "COMPLETED") {
    return { activated: false, alreadyActive: true };
  }

  const planId = intent?.planId || DEFAULT_PLAN_ID;
  const def = getPlanDefinition(planId);
  const now = new Date();
  const periodEnd =
    params.currentPeriodEnd ||
    new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const ownerUserId = intent?.ownerUserId;
  let shouldSendEmail = false;
  let rawToken: string | null = null;
  let expiresAt: Date | null = null;
  let adminName = intent?.adminName || "Administrador";
  let adminEmail = intent?.email;

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: { accessStatus: "ACTIVE" },
    });

    await tx.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: "ACTIVE",
        provider: "asaas",
        planId,
        providerCustomerId:
          params.providerCustomerId || intent?.providerCustomerId || undefined,
        providerSubscriptionId:
          params.providerSubscriptionId ||
          intent?.providerSubscriptionId ||
          undefined,
        providerCheckoutId:
          params.providerCheckoutId || intent?.providerCheckoutId || undefined,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
      },
    });

    if (intent) {
      await tx.checkoutIntent.update({
        where: { id: intent.id },
        data: {
          status: "COMPLETED",
          providerSubscriptionId:
            params.providerSubscriptionId || intent.providerSubscriptionId,
          providerCustomerId:
            params.providerCustomerId || intent.providerCustomerId,
        },
      });
    }

    if (ownerUserId) {
      const user = await tx.user.findUnique({
        where: { id: ownerUserId },
        select: { activatedAt: true, name: true, email: true },
      });
      if (user) {
        adminName = user.name;
        adminEmail = user.email;
      }
      if (user && !user.activatedAt) {
        const existing = await tx.accountActivationToken.findFirst({
          where: {
            userId: ownerUserId,
            purpose: "OWNER_ACTIVATION",
            usedAt: null,
            expiresAt: { gt: now },
          },
        });
        if (!existing) {
          const created = await createActivationToken(
            ownerUserId,
            "OWNER_ACTIVATION",
            tx,
          );
          rawToken = created.rawToken;
          expiresAt = created.expiresAt;
          shouldSendEmail = true;
        }
      }
    }

    await tx.auditLog.create({
      data: {
        organizationId,
        userId: ownerUserId ?? null,
        action: "subscription.activated",
        entityType: "OrganizationSubscription",
        entityId: organizationId,
        metadata: {
          planId,
          provider: "asaas",
          intentId: intent?.id ?? null,
        },
      },
    });
  });

  if (shouldSendEmail && rawToken && expiresAt && adminEmail) {
    const emailResult = await sendOwnerActivationEmail({
      to: adminEmail,
      adminName,
      companyName: org.name,
      planName: def.name,
      rawToken,
      expiresAt,
    });
    if (!emailResult.sent) {
      console.warn(
        `[subscription-activation] e-mail de ativação não enviado para ${adminEmail}: ${emailResult.reason ?? "unknown"}`,
      );
    }
  }

  return { activated: true, alreadyActive: false };
}

export async function markOrganizationPastDue(organizationId: string) {
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: { accessStatus: "PAST_DUE" },
    }),
    prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: "PAST_DUE",
        gracePeriodEndsAt: gracePeriodEndFromNow(),
      },
    }),
  ]);
}

export async function markOrganizationCanceled(organizationId: string) {
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: { accessStatus: "CANCELED" },
    }),
    prisma.organizationSubscription.update({
      where: { organizationId },
      data: { status: "CANCELED", cancelAtPeriodEnd: false },
    }),
  ]);
}

export async function markIntentExpired(intentId: string) {
  await prisma.checkoutIntent.update({
    where: { id: intentId },
    data: { status: "EXPIRED" },
  });
}

export async function markIntentCanceled(intentId: string) {
  await prisma.checkoutIntent.update({
    where: { id: intentId },
    data: { status: "CANCELED" },
  });
}
