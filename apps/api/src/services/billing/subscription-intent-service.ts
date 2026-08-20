import { getPlanDefinition, isPlanId, type PlanId } from "@pedidos/shared";
import { prisma } from "../../db.js";
import {
    emptyFiscalEmitente,
    fiscalConfigCreateData,
} from "../cnpj/fiscal-emitente.js";
import { lookupFiscalEmitente } from "../cnpj/lookup-fiscal-emitente.js";
import { ensureDefaultOrderSituations } from "../order-situations.js";
import { ensureOrgRolePermissions } from "../role-permissions.js";
import { unusablePasswordHash } from "./account-activation.js";
import {
    isAllowedAsaasCheckoutUrl,
    readAsaasConfig,
} from "./asaas/asaas-config.js";
import {
    checkoutReturnUrls,
    nextDueDateIso,
    type CheckoutReturnSource,
} from "./checkout-urls.js";
import { isValidCpfOrCnpj, normalizeDocument } from "./document.js";
import { PaymentGatewayError, type PaymentGateway } from "./payment-gateway.js";
import {
    isFakePaymentGatewayEnabled,
    resolvePaymentGateway,
} from "./resolve-payment-gateway.js";
import { activateOrganizationFromPayment } from "./subscription-activation.js";

export type { CheckoutReturnSource } from "./checkout-urls.js";
export { checkoutReturnUrls, nextDueDateIso } from "./checkout-urls.js";

function readStoredReturnSource(
  payload: unknown,
): CheckoutReturnSource | null {
  if (
    payload &&
    typeof payload === "object" &&
    "returnSource" in payload &&
    ((payload as { returnSource: unknown }).returnSource === "app" ||
      (payload as { returnSource: unknown }).returnSource === "landing")
  ) {
    return (payload as { returnSource: CheckoutReturnSource }).returnSource;
  }
  return null;
}

async function resolveCheckoutReturnSource(intent: {
  provider: string;
  checkoutUrl: string | null;
  checkoutPayload: unknown;
  organizationId: string | null;
  ownerUserId: string | null;
}): Promise<CheckoutReturnSource> {
  const stored = readStoredReturnSource(intent.checkoutPayload);
  if (stored) return stored;

  if (
    intent.provider === "fake" ||
    isFakePaymentGatewayEnabled() ||
    intent.checkoutUrl?.includes("/pagamento")
  ) {
    return "app";
  }

  if (intent.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: intent.organizationId },
      select: { accessStatus: true },
    });
    if (org?.accessStatus === "PENDING_PAYMENT") return "app";
  }

  if (intent.ownerUserId) {
    const user = await prisma.user.findUnique({
      where: { id: intent.ownerUserId },
      select: { activatedAt: true },
    });
    if (user?.activatedAt) return "app";
  }

  return "landing";
}

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

function requireGateway(gateway?: PaymentGateway): PaymentGateway {
  const gw = resolvePaymentGateway(gateway);
  if (!gw) {
    throw Object.assign(new Error("Pagamentos indisponíveis no momento"), {
      code: "ASAAS_NOT_CONFIGURED",
      http: 503,
    });
  }
  return gw;
}

function assertAsaasCheckoutCallbackUrls(
  urls: { successUrl: string; cancelUrl: string; expiredUrl: string },
  fake: boolean,
): void {
  if (fake) return;
  for (const url of [urls.successUrl, urls.cancelUrl, urls.expiredUrl]) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new PaymentGatewayError(
        "URL de retorno do checkout inválida",
        "ASAAS_CALLBACK_URL_INVALID",
        400,
      );
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      throw new PaymentGatewayError(
        "O Asaas exige URLs HTTPS públicas nos callbacks. Configure ASAAS_CALLBACK_APP_URL (ex.: túnel ngrok apontando para o web) e reinicie a API.",
        "ASAAS_CALLBACK_URL_LOCALHOST",
        400,
      );
    }
    if (parsed.protocol !== "https:") {
      throw new PaymentGatewayError(
        "O Asaas exige URLs HTTPS nos callbacks de checkout. Use ASAAS_CALLBACK_APP_URL com https://…",
        "ASAAS_CALLBACK_URL_HTTPS_REQUIRED",
        400,
      );
    }
  }
}

async function loadCustomerBillingProfile(
  organizationId: string,
  phone?: string | null,
): Promise<import("./payment-gateway.js").GatewayCustomerBilling> {
  const fiscal = await prisma.organizationFiscalConfig.findUnique({
    where: { organizationId },
  });
  const digits = phone?.replace(/\D/g, "") ?? "";
  const mobile =
    digits.length >= 10 && digits.length <= 11
      ? digits.length === 10
        ? `${digits.slice(0, 2)}9${digits.slice(2)}`
        : digits.slice(-11)
      : "11987654321";
  const postal = (fiscal?.zipCode ?? "01310100").replace(/\D/g, "").slice(0, 8);
  return {
    phone: mobile,
    address: fiscal?.street?.trim() || "Av Paulista",
    addressNumber: fiscal?.addressNumber?.trim() || "1000",
    complement: fiscal?.complement,
    province: fiscal?.district?.trim() || "Centro",
    postalCode: postal.length === 8 ? postal : "01310100",
    cityIbge: fiscal?.cityIbge?.replace(/\D/g, "") || "3550308",
  };
}

async function attachProviderCheckout(params: {
  intentId: string;
  organizationId: string;
  planId: PlanId;
  companyName: string;
  adminName: string;
  email: string;
  document: string;
  phone?: string | null;
  existingCustomerId?: string | null;
  source: CheckoutReturnSource;
  gateway?: PaymentGateway;
}): Promise<{ intentId: string; checkoutUrl: string }> {
  const def = getPlanDefinition(params.planId);
  const urls = checkoutReturnUrls(params.intentId, params.source);
  const gw = requireGateway(params.gateway);
  const cfg = readAsaasConfig();
  const fake = isFakePaymentGatewayEnabled();

  assertAsaasCheckoutCallbackUrls(urls, fake);

  try {
    const billing = await loadCustomerBillingProfile(
      params.organizationId,
      params.phone,
    );

    const checkout = await gw.createSubscriptionCheckout({
      customerData: {
        name: params.companyName.trim(),
        email: params.email,
        cpfCnpj: params.document,
        billing,
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
      externalReference: params.intentId,
      ...urls,
    });

    if (
      !fake &&
      cfg &&
      !isAllowedAsaasCheckoutUrl(checkout.link, cfg.checkoutUrlPrefix)
    ) {
      throw new PaymentGatewayError(
        "URL de checkout inválida",
        "ASAAS_CHECKOUT_URL_INVALID",
      );
    }

    await prisma.checkoutIntent.update({
      where: { id: params.intentId },
      data: {
        status: "CHECKOUT_CREATED",
        providerCustomerId: params.existingCustomerId,
        providerCheckoutId: checkout.id,
        checkoutUrl: checkout.link,
        expiresAt: checkout.expiresAt,
        errorCode: null,
        checkoutPayload: {
          planId: params.planId,
          amountBrl: def.monthlyPriceBrl,
          returnSource: params.source,
          providerCheckoutId: checkout.id,
        },
      },
    });

    await prisma.organizationSubscription.update({
      where: { organizationId: params.organizationId },
      data: {
        provider: fake ? "fake" : "asaas",
        providerCheckoutId: checkout.id,
      },
    });

    return { intentId: params.intentId, checkoutUrl: checkout.link };
  } catch (err) {
    const code = err instanceof PaymentGatewayError ? err.code : "ASAAS_FAILED";
    const http =
      err instanceof PaymentGatewayError && err.status ? err.status : 502;
    await prisma.checkoutIntent.update({
      where: { id: params.intentId },
      data: { status: "FAILED", errorCode: code },
    });
    throw Object.assign(
      new Error(
        err instanceof Error ? err.message : "Falha ao preparar pagamento",
      ),
      { code, http, intentId: params.intentId },
    );
  }
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

  requireGateway(gateway);

  const passwordHash = await unusablePasswordHash();
  const now = new Date();
  const emitente =
    document.length === 14
      ? await lookupFiscalEmitente(document)
      : emptyFiscalEmitente("");

  const { intent, orgId } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.companyName.trim(),
        displayName: input.companyName.trim(),
        document,
        cnpj: document.length === 14 ? document : null,
        accessStatus: "PENDING_PAYMENT",
      },
    });

    await tx.organizationFiscalConfig.create({
      data: fiscalConfigCreateData(org.id, emitente),
    });

    await tx.organizationSubscription.create({
      data: {
        organizationId: org.id,
        planId,
        status: "INCOMPLETE",
        provider: isFakePaymentGatewayEnabled() ? "fake" : "asaas",
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
        provider: isFakePaymentGatewayEnabled() ? "fake" : "asaas",
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        checkoutPayload: { planId, amountBrl: def.monthlyPriceBrl, returnSource: "landing" },
      },
    });

    return { intent, orgId: org.id };
  });

  await ensureOrgRolePermissions(orgId);
  await ensureDefaultOrderSituations(orgId);

  return attachProviderCheckout({
    intentId: intent.id,
    organizationId: orgId,
    planId,
    companyName: input.companyName,
    adminName: input.adminName,
    email,
    document,
    phone: input.phone,
    source: "landing",
    gateway,
  });
}

export async function createCheckoutForRegisteredOrg(
  input: {
    organizationId: string;
    ownerUserId: string;
    planId: PlanId;
    companyName: string;
    adminName: string;
    email: string;
    document: string;
    phone?: string | null;
    termsAcceptedAt?: Date | null;
    privacyAcceptedAt?: Date | null;
    lockAccessUntilPaid: boolean;
  },
  gateway?: PaymentGateway,
): Promise<{ intentId: string; checkoutUrl: string }> {
  requireGateway(gateway);
  const def = getPlanDefinition(input.planId);
  const now = new Date();
  const fake = isFakePaymentGatewayEnabled();
  const provider = fake ? "fake" : "asaas";

  const sub = await prisma.organizationSubscription.findUnique({
    where: { organizationId: input.organizationId },
  });

  const intent = await prisma.checkoutIntent.create({
    data: {
      organizationId: input.organizationId,
      ownerUserId: input.ownerUserId,
      planId: input.planId,
      email: input.email,
      companyName: input.companyName,
      adminName: input.adminName,
      phone: input.phone?.trim() || null,
      document: input.document,
      status: "CREATED",
      provider,
      termsAcceptedAt: input.termsAcceptedAt ?? now,
      privacyAcceptedAt: input.privacyAcceptedAt ?? now,
      checkoutPayload: {
        planId: input.planId,
        amountBrl: def.monthlyPriceBrl,
        returnSource: "app",
      },
    },
  });

  if (input.lockAccessUntilPaid) {
    await prisma.organization.update({
      where: { id: input.organizationId },
      data: { accessStatus: "PENDING_PAYMENT" },
    });
    await prisma.organizationSubscription.update({
      where: { organizationId: input.organizationId },
      data: {
        planId: input.planId,
        status: "INCOMPLETE",
        provider,
      },
    });
  } else {
    await prisma.organizationSubscription.update({
      where: { organizationId: input.organizationId },
      data: { planId: input.planId, provider },
    });
  }

  return attachProviderCheckout({
    intentId: intent.id,
    organizationId: input.organizationId,
    planId: input.planId,
    companyName: input.companyName,
    adminName: input.adminName,
    email: input.email,
    document: input.document,
    phone: input.phone,
    existingCustomerId: sub?.providerCustomerId,
    source: "app",
    gateway,
  });
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
  if (!intent.organizationId) {
    throw Object.assign(new Error("Intenção sem organização"), {
      code: "NOT_FOUND",
      http: 404,
    });
  }

  requireGateway(gateway);
  const planId = isPlanId(intent.planId) ? intent.planId : "starter";
  const source = await resolveCheckoutReturnSource(intent);

  return attachProviderCheckout({
    intentId: intent.id,
    organizationId: intent.organizationId,
    planId,
    companyName: intent.companyName,
    adminName: intent.adminName || intent.companyName,
    email: intent.email,
    document: intent.document || "",
    phone: intent.phone,
    existingCustomerId: intent.providerCustomerId,
    source,
    gateway,
  });
}

export async function getOpenCheckoutForOrg(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { accessStatus: true },
  });
  if (!org || org.accessStatus !== "PENDING_PAYMENT") {
    return null;
  }

  const intent = await prisma.checkoutIntent.findFirst({
    where: {
      organizationId,
      status: { in: ["CREATED", "CHECKOUT_CREATED", "FAILED", "EXPIRED", "CANCELED"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      checkoutUrl: true,
      planId: true,
    },
  });
  return intent;
}

export async function simulateFakePayment(intentId: string): Promise<void> {
  if (!isFakePaymentGatewayEnabled()) {
    throw Object.assign(new Error("Simulação disponível só com PAYMENT_GATEWAY=fake"), {
      code: "FAKE_GATEWAY_REQUIRED",
      http: 403,
    });
  }
  const intent = await prisma.checkoutIntent.findUnique({
    where: { id: intentId },
  });
  if (!intent?.organizationId) {
    throw Object.assign(new Error("Intenção não encontrada"), {
      code: "NOT_FOUND",
      http: 404,
    });
  }
  await activateOrganizationFromPayment({
    intentId: intent.id,
    organizationId: intent.organizationId,
    providerCustomerId: intent.providerCustomerId,
    providerCheckoutId: intent.providerCheckoutId,
  });
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
      checkoutPayload: true,
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
    | "ENTER_APP"
    | "NONE" = "WAIT";

  if (publicStatus === "ACTIVE" && intent.ownerUserId) {
    const user = await prisma.user.findUnique({
      where: { id: intent.ownerUserId },
      select: { activatedAt: true },
    });
    if (user?.activatedAt) {
      nextAction = "ENTER_APP";
    } else {
      nextAction = "SET_PASSWORD";
    }
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
    fakeGateway: isFakePaymentGatewayEnabled(),
    checkoutUrl:
      nextAction === "OPEN_CHECKOUT" || nextAction === "RETRY"
        ? intent.checkoutUrl
        : null,
  };
}
