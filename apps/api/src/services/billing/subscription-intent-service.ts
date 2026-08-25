import { DEFAULT_PLAN_ID, getPlanDefinition, isPlanId, type PlanId } from "@pedidos/shared";
import { prisma } from "../../db.js";
import {
    emptyFiscalEmitente,
    fiscalConfigCreateData,
} from "../cnpj/fiscal-emitente.js";
import { lookupFiscalEmitente } from "../cnpj/lookup-fiscal-emitente.js";
import { ensureDefaultOrderSituations } from "../order-situations.js";
import { ensureDefaultPurchaseUnits } from "../purchase-units.js";
import { ensureOrgRolePermissions } from "../role-permissions.js";
import { unusablePasswordHash } from "./account-activation.js";
import {
    nextDueDateIso,
    type CheckoutReturnSource
} from "./checkout-urls.js";
import { isValidCpfOrCnpj, normalizeDocument } from "./document.js";
import {
    sanitizePaymentErrorMessage,
    toGatewayCardPayload,
    type SubscriptionCardPayBody,
} from "./card-pay-validation.js";
import { PaymentGatewayError, type PaymentGateway } from "./payment-gateway.js";
import { resolvePaymentGateway } from "./resolve-payment-gateway.js";
import { activateOrganizationFromPayment } from "./subscription-activation.js";
import { resolveCheckoutAmountBrl } from "./seats.js";
import { syncPlanFromAsaasProvider } from "./sync-asaas-subscription.js";
import { readAsaasConfig } from "./asaas/asaas-config.js";
import {
    assertAsaasSubscriptionBelongsToCustomer,
    resolveAsaasCustomerForOrg,
} from "./asaas/asaas-customer-resolver.js";

export type { CheckoutReturnSource } from "./checkout-urls.js";
export { checkoutReturnUrls, nextDueDateIso } from "./checkout-urls.js";

function readCheckoutChangeType(
  payload: unknown,
): "plan_change" | "initial" | null {
  if (
    payload &&
    typeof payload === "object" &&
    "changeType" in payload &&
    (payload as { changeType: unknown }).changeType === "plan_change"
  ) {
    return "plan_change";
  }
  if (
    payload &&
    typeof payload === "object" &&
    "changeType" in payload &&
    (payload as { changeType: unknown }).changeType === "initial"
  ) {
    return "initial";
  }
  return null;
}

function readAmountBrl(payload: unknown): number | null {
  if (
    payload &&
    typeof payload === "object" &&
    "amountBrl" in payload &&
    typeof (payload as { amountBrl: unknown }).amountBrl === "number"
  ) {
    return (payload as { amountBrl: number }).amountBrl;
  }
  return null;
}

function readPreviousPlanId(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "previousPlanId" in payload &&
    typeof (payload as { previousPlanId: unknown }).previousPlanId === "string"
  ) {
    return (payload as { previousPlanId: string }).previousPlanId;
  }
  return null;
}

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

  if (intent.checkoutUrl?.includes("/pagamento")) {
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


async function loadCustomerBillingProfile(
  organizationId: string,
  phone?: string | null,
): Promise<import("./payment-gateway.js").GatewayCustomerBilling> {
  const fiscal = await prisma.establishment.findFirst({
    where: { organizationId, isPrimary: true },
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

async function finalizeIntentForInAppPayment(params: {
  intentId: string;
  organizationId: string;
  planId: PlanId;
  source: CheckoutReturnSource;
  gateway?: PaymentGateway;
}): Promise<{ intentId: string; checkoutUrl: null }> {
  const existing = await prisma.checkoutIntent.findUnique({
    where: { id: params.intentId },
    select: { checkoutPayload: true },
  });
  const prevPayload =
    existing?.checkoutPayload &&
    typeof existing.checkoutPayload === "object" &&
    !Array.isArray(existing.checkoutPayload)
      ? (existing.checkoutPayload as Record<string, unknown>)
      : {};

  const isPlanChange = readCheckoutChangeType(prevPayload) === "plan_change";
  const amountBrl = await resolveCheckoutAmountBrl(
    params.planId,
    params.organizationId,
    isPlanChange,
  );

  await prisma.checkoutIntent.update({
    where: { id: params.intentId },
    data: {
      status: "CREATED",
      checkoutUrl: null,
      providerCheckoutId: null,
      expiresAt: null,
      errorCode: null,
      checkoutPayload: {
        ...prevPayload,
        planId: params.planId,
        amountBrl,
        returnSource: params.source,
        paymentMode: "in_app_card",
      },
    },
  });

  await prisma.organizationSubscription.update({
    where: { organizationId: params.organizationId },
    data: {
      provider: "asaas",
    },
  });

  return { intentId: params.intentId, checkoutUrl: null };
}

export async function createSubscriptionIntent(
  input: CreateSubscriptionIntentInput,
  gateway?: PaymentGateway,
): Promise<{ intentId: string; checkoutUrl: null }> {
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

    await tx.establishment.create({
      data: fiscalConfigCreateData(org.id, emitente, input.companyName.trim()),
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
        checkoutPayload: { planId, amountBrl: def.monthlyPriceBrl, returnSource: "landing" },
      },
    });

    return { intent, orgId: org.id };
  });

  await ensureOrgRolePermissions(orgId);
  await ensureDefaultOrderSituations(orgId);
  await ensureDefaultPurchaseUnits(orgId);

  return finalizeIntentForInAppPayment({
    intentId: intent.id,
    organizationId: orgId,
    planId,
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
): Promise<{ intentId: string; checkoutUrl: null }> {
  requireGateway(gateway);
  const now = new Date();
  const provider = "asaas";

  await syncPlanFromAsaasProvider(input.organizationId, { force: true });

  const sub = await prisma.organizationSubscription.findUnique({
    where: { organizationId: input.organizationId },
  });
  const isPlanChange =
    !input.lockAccessUntilPaid &&
    sub?.status === "ACTIVE" &&
    Boolean(sub.providerSubscriptionId) &&
    sub.planId !== input.planId;
  const amountBrl = await resolveCheckoutAmountBrl(
    input.planId,
    input.organizationId,
    isPlanChange,
  );

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
        amountBrl,
        returnSource: "app",
        changeType: isPlanChange ? "plan_change" : "initial",
        previousPlanId: isPlanChange ? sub?.planId ?? null : null,
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
  } else if (!isPlanChange) {
    await prisma.organizationSubscription.update({
      where: { organizationId: input.organizationId },
      data: { planId: input.planId, provider },
    });
  }

  return finalizeIntentForInAppPayment({
    intentId: intent.id,
    organizationId: input.organizationId,
    planId: input.planId,
    source: "app",
    gateway,
  });
}

export async function retrySubscriptionCheckout(
  intentId: string,
  gateway?: PaymentGateway,
): Promise<{ intentId: string; checkoutUrl: null }> {
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
  const planId = isPlanId(intent.planId) ? intent.planId : DEFAULT_PLAN_ID;
  const source = await resolveCheckoutReturnSource(intent);

  await prisma.checkoutIntent.update({
    where: { id: intent.id },
    data: {
      status: "CREATED",
      errorCode: null,
      checkoutUrl: null,
      providerCheckoutId: null,
      expiresAt: null,
    },
  });

  return finalizeIntentForInAppPayment({
    intentId: intent.id,
    organizationId: intent.organizationId,
    planId,
    source,
    gateway,
  });
}

export async function paySubscriptionIntentWithCard(
  intentId: string,
  body: SubscriptionCardPayBody,
  remoteIp: string,
  auth?: { organizationId: string; userId: string; role: string },
  gateway?: PaymentGateway,
): Promise<{ intentId: string; status: "PROCESSING" | "ACTIVE" }> {
  const intent = await prisma.checkoutIntent.findUnique({
    where: { id: intentId },
  });
  if (!intent?.organizationId) {
    throw Object.assign(new Error("Intenção não encontrada"), {
      code: "NOT_FOUND",
      http: 404,
    });
  }
  if (intent.status === "COMPLETED") {
    throw Object.assign(new Error("Contratação já concluída"), {
      code: "ALREADY_COMPLETED",
      http: 400,
    });
  }
  if (intent.status === "PAYMENT_PROCESSING") {
    return { intentId, status: "PROCESSING" };
  }
  if (!["CREATED", "CHECKOUT_CREATED", "FAILED", "EXPIRED", "CANCELED"].includes(intent.status)) {
    throw Object.assign(new Error("Intenção não elegível para pagamento"), {
      code: "NOT_PAYABLE",
      http: 400,
    });
  }

  if (auth) {
    if (auth.role !== "ADMIN" || auth.organizationId !== intent.organizationId) {
      throw Object.assign(new Error("Sem permissão para pagar esta intenção"), {
        code: "FORBIDDEN",
        http: 403,
      });
    }
  } else if (
    body.creditCardHolderInfo.email.trim().toLowerCase() !==
    intent.email.trim().toLowerCase()
  ) {
    throw Object.assign(
      new Error("E-mail do titular deve coincidir com o da contratação"),
      { code: "EMAIL_MISMATCH", http: 400 },
    );
  }

  const planId = isPlanId(intent.planId) ? intent.planId : DEFAULT_PLAN_ID;
  const def = getPlanDefinition(planId);
  const gw = requireGateway(gateway);
  const cardPayload = toGatewayCardPayload(body);

  const sub = await prisma.organizationSubscription.findUnique({
    where: { organizationId: intent.organizationId },
  });

  const billing = await loadCustomerBillingProfile(
    intent.organizationId,
    intent.phone,
  );

  const document = intent.document || cardPayload.creditCardHolderInfo.cpfCnpj;
  const changeType = readCheckoutChangeType(intent.checkoutPayload);
  const isPlanChange =
    Boolean(sub?.providerSubscriptionId) &&
    sub?.status === "ACTIVE" &&
    (changeType === "plan_change" || sub.planId !== planId);
  const amountBrl = await resolveCheckoutAmountBrl(
    planId,
    intent.organizationId,
    isPlanChange,
  );

  const asaasCfg = readAsaasConfig();
  let resolvedCustomerId: string | undefined;

  if (asaasCfg) {
    try {
      resolvedCustomerId = await resolveAsaasCustomerForOrg(asaasCfg, {
        organizationId: intent.organizationId,
        cpfCnpj: document,
        email: intent.email,
        storedCustomerId: sub?.providerCustomerId ?? intent.providerCustomerId,
      });
    } catch (err) {
      if (
        err instanceof PaymentGatewayError &&
        err.code === "ASAAS_CUSTOMER_NOT_FOUND"
      ) {
        const created = await gw.createCustomer({
          name: intent.companyName.trim(),
          email: intent.email,
          cpfCnpj: document,
          mobilePhone: billing.phone,
          externalReference: intent.organizationId,
        });
        resolvedCustomerId = created.id;
      } else {
        throw err;
      }
    }
  }

  try {
    let result: Awaited<ReturnType<PaymentGateway["createSubscriptionWithCard"]>>;

    if (isPlanChange && sub?.providerSubscriptionId) {
      const customerId = resolvedCustomerId ?? sub.providerCustomerId ?? "";
      if (!customerId) {
        throw new PaymentGatewayError(
          "Cliente Asaas não encontrado para alteração de plano",
          "ASAAS_CUSTOMER_REQUIRED",
          400,
        );
      }
      if (asaasCfg) {
        await assertAsaasSubscriptionBelongsToCustomer(
          asaasCfg,
          sub.providerSubscriptionId,
          customerId,
        );
      }
      result = await gw.upgradeSubscriptionWithCard({
        subscriptionId: sub.providerSubscriptionId,
        customerId,
        value: amountBrl,
        description: `Assinatura PedixPro — Plano ${def.name}`,
        updatePendingPayments: true,
        remoteIp,
        ...cardPayload,
      });
    } else {
      result = await gw.createSubscriptionWithCard({
        customerId: resolvedCustomerId ?? sub?.providerCustomerId ?? intent.providerCustomerId ?? undefined,
        customer: {
          name: intent.companyName.trim(),
          email: intent.email,
          cpfCnpj: document,
          mobilePhone: billing.phone,
          externalReference: intent.organizationId,
        },
        customerBilling: billing,
        value: amountBrl,
        cycle: "MONTHLY",
        nextDueDate: nextDueDateIso(),
        description: `Assinatura PedixPro — Plano ${def.name}`,
        externalReference: intent.id,
        remoteIp,
        ...cardPayload,
      });
    }

    await prisma.checkoutIntent.update({
      where: { id: intent.id },
      data: {
        status: "PAYMENT_PROCESSING",
        providerCustomerId: result.customerId,
        providerSubscriptionId: result.subscriptionId,
        providerCheckoutId: null,
        checkoutUrl: null,
        errorCode: null,
        checkoutPayload: {
          planId,
          amountBrl,
          paymentMode: "in_app_card",
          changeType: isPlanChange ? "plan_change" : "initial",
          previousPlanId: readPreviousPlanId(intent.checkoutPayload),
          creditCardBrand: result.creditCardBrand ?? null,
          creditCardLast4: result.creditCardLast4 ?? null,
        },
      },
    });

    await prisma.organizationSubscription.update({
      where: { organizationId: intent.organizationId },
      data: {
        provider: "asaas",
        providerCustomerId: result.customerId,
        providerSubscriptionId: result.subscriptionId,
      },
    });

    if (isPlanChange) {
      await activateOrganizationFromPayment({
        intentId: intent.id,
        organizationId: intent.organizationId,
        providerCustomerId: result.customerId,
        providerSubscriptionId: result.subscriptionId,
      });
      await syncPlanFromAsaasProvider(intent.organizationId, { force: true });
      return { intentId, status: "ACTIVE" };
    }

    return { intentId, status: "PROCESSING" };
  } catch (err) {
    const code = err instanceof PaymentGatewayError ? err.code : "PAYMENT_FAILED";
    const http =
      err instanceof PaymentGatewayError && err.status ? err.status : 402;
    const message = sanitizePaymentErrorMessage(
      err instanceof Error ? err.message : "Pagamento recusado",
    );
    await prisma.checkoutIntent.update({
      where: { id: intent.id },
      data: { status: "FAILED", errorCode: code },
    });
    throw Object.assign(new Error(message), { code, http, intentId });
  }
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
      email: true,
      adminName: true,
      document: true,
      phone: true,
      companyName: true,
    },
  });
  if (!intent) return null;

  const { mapIntentToPublicStatus } = await import("@pedidos/shared");
  const publicStatus = mapIntentToPublicStatus(intent.status);

  let nextAction: import("@pedidos/shared").PublicIntentNextAction = "WAIT";

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
  } else if (publicStatus === "PENDING") {
    nextAction = "PAY_CARD";
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
    amountBrl:
      readAmountBrl(intent.checkoutPayload) ??
      getPlanDefinition(intent.planId).monthlyPriceBrl,
    checkoutUrl: null,
    changeType: readCheckoutChangeType(intent.checkoutPayload),
    previousPlanId: readPreviousPlanId(intent.checkoutPayload),
    billingDefaults: {
      email: intent.email,
      holderName: intent.adminName || intent.companyName,
      holderFullName: intent.adminName || intent.companyName,
      cpfCnpj: intent.document || "",
      mobilePhone: intent.phone || "",
    },
  };
}
