import type { User } from "@prisma/client";
import { prisma } from "../../db.js";

/** Usuário dono da intenção, após pagamento confirmado e org ativa. */
export async function resolveUserForCompletedCheckout(
  intentId: string,
): Promise<User & { seller: { id: string } | null }> {
  const intent = await prisma.checkoutIntent.findUnique({
    where: { id: intentId },
    select: {
      id: true,
      status: true,
      ownerUserId: true,
      organizationId: true,
      checkoutPayload: true,
    },
  });

  if (!intent?.ownerUserId || !intent.organizationId) {
    throw Object.assign(new Error("Intenção não encontrada"), {
      code: "NOT_FOUND",
      http: 404,
    });
  }

  if (intent.status !== "COMPLETED") {
    throw Object.assign(
      new Error("Pagamento ainda não confirmado. Aguarde alguns segundos."),
      { code: "PAYMENT_NOT_CONFIRMED", http: 409 },
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: intent.organizationId },
    select: { accessStatus: true },
  });

  if (org?.accessStatus !== "ACTIVE") {
    throw Object.assign(new Error("Assinatura ainda não está ativa."), {
      code: "ORG_NOT_ACTIVE",
      http: 409,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: intent.ownerUserId },
    include: { seller: true },
  });

  if (!user) {
    throw Object.assign(new Error("Usuário não encontrado"), {
      code: "NOT_FOUND",
      http: 404,
    });
  }

  if (!user.activatedAt) {
    throw Object.assign(
      new Error(
        "Defina sua senha pelo link enviado por e-mail antes de entrar.",
      ),
      { code: "ACCOUNT_NOT_ACTIVATED", http: 403 },
    );
  }

  return user;
}
