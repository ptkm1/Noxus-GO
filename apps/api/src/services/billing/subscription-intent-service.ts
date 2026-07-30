import { getPlanDefinition, isPlanId, type PlanId } from "@pedidos/shared";
import { prisma } from "../../db.js";
import { ensureDefaultOrderSituations } from "../order-situations.js";
import { ensureOrgRolePermissions } from "../role-permissions.js";
import { unusablePasswordHash } from "./account-activation.js";
import {
  isAllowedAsaasCheckoutUrl,
  readAsaasConfig,
} from "./asaas/asaas-config.js";
import { createAsaasPaymentGateway } from "./asaas/asaas-payment-gateway.js";
import { isValidCpfOrCnpj, normalizeDocument } from "./document.js";
import { PaymentGatewayError, type PaymentGateway } from "./payment-gateway.js";

export type CreateSubscriptionIntentInput = {
  planId: string;
  companyName: string;
  adminName: string;
  email: string;
  phone?: string;
  document: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

function nextDueDateIso(): string {
  const d = new Date();
  // Asaas expects date; use today (sandbox) so first charge can confirm soon
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function createSubscriptionIntent(
  input: CreateSubscriptionIntentInput,
  gateway?: PaymentGateway,
): Promise<{ intentId: string; checkoutUrl: string }> {
  if (!input.termsAccepted || !input.privacyAccepted) {
    throw Object.assign(new Error("Aceite os termos e a privacidade"), {
      code: "TERMS_REQUIRED",
      http: 400,
    });
  }
  if (!isPlanId(input.planId)) {
    throw Object.assign(new Error("Plano inválido"), {
      code: "INVALID_PLAN",
      http: 400,
    });
  }
  const planId = input.planId as PlanId;
  const def = getPlanDefinition(planId);
  const document = normalizeDocument(input.document);
  if (!isValidCpfOrCnpj(document)) {
    throw Object.assign(new Error("CPF ou CNPJ inválido"), {
      code: "INVALID_DOCUMENT",
      http: 400,
    });
  }

  const email = input.email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw Object.assign(new Error("E-mail já cadastrado"), {
      code: "EMAIL_EXISTS",
      http: 409,
    });
  }

  const existingDoc = await prisma.organization.findFirst({
    where: { document },
    select: { id: true },
  });
  if (existingDoc) {
    throw Object.assign(new Error("Documento já cadastrado"), {
      code: "DOCUMENT_EXISTS",
      http: 409,
    });
  }

  const cfg = readAsaasConfig();
  if (!cfg && !gateway) {
    throw Object.assign(new Error("Pagamentos indisponíveis no momento"), {
      code: "ASAAS_NOT_CONFIGURED",
      http: 503,
    });
  }

  const passwordHash = await unusablePasswordHash();
  const now = new Date();

  const { intent, orgId, userId } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.companyName.trim(),
        displayName: input.companyName.trim(),
        document,
        cnpj: document.length === 14 ? document : null,
        accessStatus: "PENDING_PAYMENT",
      },
    });

    await tx.organizationSubscription.create({
      data: {
        organizationId: org.id,
        planId,
        status: "INCOMPLETE",
        provider: "asaas",
        currentPeriodStart: now,
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        name: input.adminName.trim(),
        passwordHash,
        role: "ADMIN",
        organizationId: org.id,
        activatedAt: null,
      },
    });

    const intent = await tx.checkoutIntent.create({
      data: {
        organizationId: org.id,
        ownerUserId: user.id,
        planId,
        email,
        companyName: input.companyName.trim(),
        adminName: input.adminName.trim(),
        phone: input.phone?.trim() || null,
        document,
        status: "CREATED",
        provider: "asaas",
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        checkoutPayload: { planId, amountBrl: def.monthlyPriceBrl },
      },
    });

    return { intent, orgId: org.id, userId: user.id };
  });

  await ensureOrgRolePermissions(orgId);
  await ensureDefaultOrderSituations(orgId);

  const landing = cfg?.landingUrl || "http://localhost:3001";
  const successUrl = `${landing}/contratacao/processando?intentId=${intent.id}`;
  const cancelUrl = `${landing}/contratacao/processando?intentId=${intent.id}&result=canceled`;
  const expiredUrl = `${landing}/contratacao/processando?intentId=${intent.id}&result=expired`;

  const gw = gateway ?? createAsaasPaymentGateway(cfg!);

  try {
    const customer = await gw.createCustomer({
      name: input.companyName.trim(),
      email,
      cpfCnpj: document,
      mobilePhone: input.phone?.trim() || null,
      externalReference: orgId,
    });

    const checkout = await gw.createSubscriptionCheckout({
      customerId: customer.id,
      customerData: {
        name: input.adminName.trim(),
        email,
        cpfCnpj: document,
        phone: input.phone?.trim() || null,
      },
      items: [
        {
          name: `Assinatura PedixPro — Plano ${def.name}`,
          description: `Assinatura mensal PedixPro (${def.id})`,
          quantity: 1,
          value: def.monthlyPriceBrl,
        },
      ],
      cycle: "MONTHLY",
      nextDueDate: nextDueDateIso(),
      minutesToExpire: 120,
      externalReference: intent.id,
      successUrl,
      cancelUrl,
      expiredUrl,
    });

    if (
      cfg &&
      !isAllowedAsaasCheckoutUrl(checkout.link, cfg.checkoutUrlPrefix)
    ) {
      throw new PaymentGatewayError(
        "URL de checkout inválida",
        "ASAAS_CHECKOUT_URL_INVALID",
      );
    }

    await prisma.checkoutIntent.update({
      where: { id: intent.id },
      data: {
        status: "CHECKOUT_CREATED",
        providerCustomerId: customer.id,
        providerCheckoutId: checkout.id,
        checkoutUrl: checkout.link,
        expiresAt: checkout.expiresAt,
        checkoutPayload: {
          planId,
          amountBrl: def.monthlyPriceBrl,
          providerCustomerId: customer.id,
          providerCheckoutId: checkout.id,
        },
      },
    });

    await prisma.organizationSubscription.update({
      where: { organizationId: orgId },
      data: {
        providerCustomerId: customer.id,
        providerCheckoutId: checkout.id,
      },
    });

    return { intentId: intent.id, checkoutUrl: checkout.link };
  } catch (err) {
    const code = err instanceof PaymentGatewayError ? err.code : "ASAAS_FAILED";
    await prisma.checkoutIntent.update({
      where: { id: intent.id },
      data: { status: "FAILED", errorCode: code },
    });
    throw Object.assign(
      new Error(
        err instanceof Error ? err.message : "Falha ao preparar pagamento",
      ),
      { code, http: 502, intentId: intent.id },
    );
  }
}

export async function retrySubscriptionCheckout(
  intentId: string,
  gateway?: PaymentGateway,
): Promise<{ intentId: string; checkoutUrl: string }> {
  const intent = await prisma.checkoutIntent.findUnique({
    where: { id: intentId },
  });
  if (!intent) {
    throw Object.assign(new Error("Intenção não encontrada"), {
      code: "NOT_FOUND",
      http: 404,
    });
  }
  if (
    !["FAILED", "EXPIRED", "CANCELED", "CHECKOUT_CREATED"].includes(
      intent.status,
    )
  ) {
    throw Object.assign(new Error("Intenção não elegível para novo checkout"), {
      code: "NOT_RETRYABLE",
      http: 400,
    });
  }
  if (intent.status === "COMPLETED") {
    throw Object.assign(new Error("Contratação já concluída"), {
      code: "ALREADY_COMPLETED",
      http: 400,
    });
  }

  const cfg = readAsaasConfig();
  if (!cfg && !gateway) {
    throw Object.assign(new Error("Pagamentos indisponíveis"), {
      code: "ASAAS_NOT_CONFIGURED",
      http: 503,
    });
  }

  const def = getPlanDefinition(intent.planId);
  const landing = cfg?.landingUrl || "http://localhost:3001";
  const successUrl = `${landing}/contratacao/processando?intentId=${intent.id}`;
  const cancelUrl = `${landing}/contratacao/processando?intentId=${intent.id}&result=canceled`;
  const expiredUrl = `${landing}/contratacao/processando?intentId=${intent.id}&result=expired`;
  const gw = gateway ?? createAsaasPaymentGateway(cfg!);

  let customerId = intent.providerCustomerId;
  if (!customerId) {
    const customer = await gw.createCustomer({
      name: intent.companyName,
      email: intent.email,
      cpfCnpj: intent.document || "",
      mobilePhone: intent.phone,
      externalReference: intent.organizationId || intent.id,
    });
    customerId = customer.id;
  }

  const checkout = await gw.createSubscriptionCheckout({
    customerId,
    items: [
      {
        name: `Assinatura PedixPro — Plano ${def.name}`,
        quantity: 1,
        value: def.monthlyPriceBrl,
      },
    ],
    cycle: "MONTHLY",
    nextDueDate: nextDueDateIso(),
    minutesToExpire: 120,
    externalReference: intent.id,
    successUrl,
    cancelUrl,
    expiredUrl,
  });

  await prisma.checkoutIntent.update({
    where: { id: intent.id },
    data: {
      status: "CHECKOUT_CREATED",
      providerCustomerId: customerId,
      providerCheckoutId: checkout.id,
      checkoutUrl: checkout.link,
      expiresAt: checkout.expiresAt,
      errorCode: null,
    },
  });

  if (intent.organizationId) {
    await prisma.organizationSubscription.update({
      where: { organizationId: intent.organizationId },
      data: {
        providerCustomerId: customerId,
        providerCheckoutId: checkout.id,
      },
    });
  }

  return { intentId: intent.id, checkoutUrl: checkout.link };
}

export async function getPublicIntentStatus(intentId: string) {
  const intent = await prisma.checkoutIntent.findUnique({
    where: { id: intentId },
    select: {
      id: true,
      status: true,
      checkoutUrl: true,
      planId: true,
      ownerUserId: true,
      organizationId: true,
    },
  });
  if (!intent) return null;

  const { mapIntentToPublicStatus } = await import("@pedidos/shared");
  const publicStatus = mapIntentToPublicStatus(intent.status);

  let nextAction:
    | "WAIT"
    | "SET_PASSWORD"
    | "OPEN_CHECKOUT"
    | "RETRY"
    | "LOGIN"
    | "NONE" = "WAIT";

  if (publicStatus === "ACTIVE" && intent.ownerUserId) {
    const user = await prisma.user.findUnique({
      where: { id: intent.ownerUserId },
      select: { activatedAt: true },
    });
    nextAction = user?.activatedAt ? "LOGIN" : "SET_PASSWORD";
  } else if (publicStatus === "PENDING" && intent.checkoutUrl) {
    nextAction = "OPEN_CHECKOUT";
  } else if (publicStatus === "FAILED" || publicStatus === "EXPIRED") {
    nextAction = "RETRY";
  } else if (publicStatus === "CANCELED") {
    nextAction = "RETRY";
  } else if (publicStatus === "PROCESSING") {
    nextAction = "WAIT";
  }

  return {
    status: publicStatus,
    nextAction,
    intentId: intent.id,
    planId: intent.planId,
    checkoutUrl:
      nextAction === "OPEN_CHECKOUT" || nextAction === "RETRY"
        ? intent.checkoutUrl
        : null,
  };
}
