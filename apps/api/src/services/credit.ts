import type {
  CreditPolicy,
  CreditTitleStatus,
  Prisma,
  ReceivableStatus,
} from "@prisma/client";
import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";
import {
  getSellerShowUnassignedCustomers,
  sellerCustomerSellableWhere,
} from "./seller-customer-access.js";

export type CreditViolation = { code: string; message: string };

export type CreditEffectiveAction = "ALLOW" | "BLOCK" | "APPROVAL";

/** Resultado de checkCustomer — só PostgreSQL local (nunca API do banco). */
export type CustomerCreditCheckStatus = "OK" | "BLOCKED" | "WARN";

export type CustomerCreditCheck = {
  status: CustomerCreditCheckStatus;
  reason?: string;
  overdueAmount?: number;
  openAmount?: number;
  overdueReceivables?: Array<{
    id: string;
    amount: number;
    paidAmount: number;
    remaining: number;
    dueDate: string;
    status: ReceivableStatus;
    nossoNumero: string | null;
  }>;
  policy: CreditPolicy;
  action: CreditEffectiveAction;
  violations: CreditViolation[];
};

const EPS = 1e-6;

/** Extensível: tolerância em dias após vencimento (0 = no dia). Via org metadata futuro. */
const DEFAULT_OVERDUE_GRACE_DAYS = 0;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function startOfToday(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate(), 0, 0, 0, 0);
}

function dueCutoff(at: Date, graceDays = DEFAULT_OVERDUE_GRACE_DAYS): Date {
  const d = startOfToday(at);
  if (graceDays > 0) d.setDate(d.getDate() - graceDays);
  return d;
}

const OPEN_RECEIVABLE: ReceivableStatus[] = [
  "PENDING",
  "PARTIALLY_PAID",
  "OVERDUE",
];

export function resolveCreditEffectiveAction(
  policy: CreditPolicy,
  violations: CreditViolation[],
): CreditEffectiveAction {
  if (!violations.length) return "ALLOW";
  if (policy === "WARN_ONLY") return "ALLOW";
  if (policy === "BLOCK_ORDER") return "BLOCK";
  return "APPROVAL";
}

export async function computeCreditViolations(input: {
  organizationId: string;
  customerId: string | null;
  /** Valor extra (total do pedido) para validar limite com saldo atual + pedido. */
  previewOrderTotal?: number | null;
}): Promise<{ violations: CreditViolation[]; policy: CreditPolicy }> {
  const { organizationId, customerId } = input;
  const previewOrderTotal = input.previewOrderTotal ?? null;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { creditPolicy: true },
  });
  const policy = org?.creditPolicy ?? "WARN_ONLY";

  if (!customerId) {
    return { violations: [], policy };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: {
      id: true,
      creditBlocked: true,
      creditLimit: true,
    },
  });
  if (!customer) {
    return { violations: [], policy };
  }

  const [titles, receivables] = await Promise.all([
    prisma.customerCreditTitle.findMany({
      where: {
        organizationId,
        customerId,
        status: "OPEN",
      },
    }),
    prisma.receivable.findMany({
      where: {
        organizationId,
        customerId,
        status: { in: OPEN_RECEIVABLE },
      },
    }),
  ]);

  let openBalance = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  const cutoff = dueCutoff(new Date());

  for (const t of titles) {
    const amt = decToNum(t.amount);
    const paid = decToNum(t.paidAmount);
    const remaining = roundMoney(amt - paid);
    if (remaining <= EPS) continue;
    openBalance = roundMoney(openBalance + remaining);
    if (t.dueDate < cutoff) {
      overdueAmount = roundMoney(overdueAmount + remaining);
      overdueCount++;
    }
  }

  let overdueReceivableCount = 0;
  for (const r of receivables) {
    const amt = decToNum(r.amount);
    const paid = decToNum(r.paidAmount);
    const remaining = roundMoney(amt - paid);
    if (remaining <= EPS) continue;
    openBalance = roundMoney(openBalance + remaining);
    const isOverdue = r.status === "OVERDUE" || r.dueDate < cutoff;
    if (isOverdue) {
      overdueAmount = roundMoney(overdueAmount + remaining);
      overdueCount++;
      overdueReceivableCount++;
    }
  }

  const violations: CreditViolation[] = [];

  if (customer.creditBlocked) {
    violations.push({
      code: "CUSTOMER_BLOCKED",
      message: "Cliente bloqueado para novas vendas. Procure o escritório.",
    });
  }

  if (overdueCount > 0) {
    const boletoHint =
      overdueReceivableCount > 0
        ? ` (inclui ${overdueReceivableCount} boleto(s) bancário(s))`
        : "";
    violations.push({
      code: "OVERDUE_TITLES",
      message: `Há ${overdueCount} título(s) vencido(s) em aberto (total vencido R$ ${overdueAmount.toFixed(2).replace(".", ",")})${boletoHint}.`,
    });
  }

  const creditLimit =
    customer.creditLimit != null
      ? roundMoney(decToNum(customer.creditLimit))
      : null;

  if (creditLimit != null) {
    if (openBalance > creditLimit + EPS) {
      violations.push({
        code: "LIMIT_OVERDRAWN_CURRENT",
        message: `Limite já estourado (limite R$ ${creditLimit.toFixed(2).replace(".", ",")} · em aberto R$ ${openBalance.toFixed(2).replace(".", ",")}).`,
      });
    }
    if (
      previewOrderTotal != null &&
      previewOrderTotal > EPS &&
      roundMoney(openBalance + previewOrderTotal) > creditLimit + EPS
    ) {
      violations.push({
        code: "LIMIT_EXCEEDED_WITH_ORDER",
        message: `Pedido ultrapassa o limite (limite R$ ${creditLimit.toFixed(2).replace(".", ",")} · em aberto R$ ${openBalance.toFixed(2).replace(".", ",")} · pedido R$ ${previewOrderTotal.toFixed(2).replace(".", ",")}).`,
      });
    }
  }

  return { violations, policy };
}

export async function evaluateOrderCredit(params: {
  organizationId: string;
  customerId: string | null;
  proposedOrderTotal: number;
}): Promise<{
  violations: CreditViolation[];
  policy: CreditPolicy;
  action: CreditEffectiveAction;
}> {
  const { violations, policy } = await computeCreditViolations({
    organizationId: params.organizationId,
    customerId: params.customerId,
    previewOrderTotal: params.proposedOrderTotal,
  });
  const action = resolveCreditEffectiveAction(policy, violations);
  return { violations, policy, action };
}

/**
 * Checagem de crédito do cliente lendo apenas o banco local.
 * Usado na confirmação de pedido e na UI de cliente.
 */
export async function checkCustomer(
  organizationId: string,
  customerId: string,
  previewOrderTotal?: number | null,
): Promise<CustomerCreditCheck> {
  const { violations, policy } = await computeCreditViolations({
    organizationId,
    customerId,
    previewOrderTotal: previewOrderTotal ?? null,
  });
  const action = resolveCreditEffectiveAction(policy, violations);

  const cutoff = dueCutoff(new Date());
  const receivables = await prisma.receivable.findMany({
    where: {
      organizationId,
      customerId,
      status: { in: OPEN_RECEIVABLE },
    },
    orderBy: { dueDate: "asc" },
    take: 40,
  });

  const overdueReceivables: NonNullable<
    CustomerCreditCheck["overdueReceivables"]
  > = [];
  let openAmount = 0;
  let overdueAmount = 0;
  for (const r of receivables) {
    const amt = decToNum(r.amount);
    const paid = decToNum(r.paidAmount);
    const remaining = roundMoney(amt - paid);
    if (remaining <= EPS) continue;
    openAmount = roundMoney(openAmount + remaining);
    if (r.status === "OVERDUE" || r.dueDate < cutoff) {
      overdueAmount = roundMoney(overdueAmount + remaining);
      overdueReceivables.push({
        id: r.id,
        amount: amt,
        paidAmount: paid,
        remaining,
        dueDate: r.dueDate.toISOString(),
        status: r.status,
        nossoNumero: r.nossoNumero,
      });
    }
  }

  // Soma títulos manuais ao open/overdue reportados
  const titles = await prisma.customerCreditTitle.findMany({
    where: { organizationId, customerId, status: "OPEN" },
  });
  for (const t of titles) {
    const remaining = roundMoney(decToNum(t.amount) - decToNum(t.paidAmount));
    if (remaining <= EPS) continue;
    openAmount = roundMoney(openAmount + remaining);
    if (t.dueDate < cutoff) {
      overdueAmount = roundMoney(overdueAmount + remaining);
    }
  }

  let status: CustomerCreditCheckStatus = "OK";
  if (action === "BLOCK" || customerBlocked(violations)) {
    status = "BLOCKED";
  } else if (violations.length > 0) {
    status = "WARN";
  }

  return {
    status,
    reason: violations[0]?.message,
    overdueAmount: overdueAmount > EPS ? overdueAmount : undefined,
    openAmount: openAmount > EPS ? openAmount : undefined,
    overdueReceivables:
      overdueReceivables.length > 0 ? overdueReceivables : undefined,
    policy,
    action,
    violations,
  };
}

function customerBlocked(violations: CreditViolation[]): boolean {
  return violations.some((v) => v.code === "CUSTOMER_BLOCKED");
}

export function violationsToJson(
  violations: CreditViolation[],
): Prisma.InputJsonValue {
  return violations as unknown as Prisma.InputJsonValue;
}

export async function buildSellerCustomerCreditSnapshot(params: {
  organizationId: string;
  customerId: string;
  sellerId: string;
  previewAmount?: number | null;
}): Promise<{
  customerId: string;
  creditBlocked: boolean;
  creditLimit: number | null;
  creditPolicy: CreditPolicy;
  openBalance: number;
  overdueCount: number;
  overdueAmount: number;
  violations: CreditViolation[];
  effectiveAction: CreditEffectiveAction;
  titlesOpen: Array<{
    id: string;
    reference: string | null;
    amount: number;
    paidAmount: number;
    remaining: number;
    issueDate: string;
    dueDate: string;
    overdue: boolean;
    status: CreditTitleStatus;
    notes: string | null;
  }>;
  titlesHistory: Array<{
    id: string;
    reference: string | null;
    amount: number;
    paidAmount: number;
    remaining: number;
    issueDate: string;
    dueDate: string;
    status: CreditTitleStatus;
    notes: string | null;
  }>;
  creditCheck: CustomerCreditCheck;
}> {
  const showUnassigned = await getSellerShowUnassignedCustomers(
    params.organizationId,
  );
  const cust = await prisma.customer.findFirst({
    where: {
      id: params.customerId,
      ...sellerCustomerSellableWhere(
        params.organizationId,
        params.sellerId,
        showUnassigned,
      ),
    },
    select: {
      id: true,
      creditBlocked: true,
      creditLimit: true,
    },
  });
  if (!cust) {
    throw new Error("CLIENT_NOT_FOUND");
  }

  const org = await prisma.organization.findUnique({
    where: { id: params.organizationId },
    select: { creditPolicy: true },
  });

  const { violations, policy } = await computeCreditViolations({
    organizationId: params.organizationId,
    customerId: cust.id,
    previewOrderTotal: params.previewAmount ?? null,
  });

  const effectiveAction = resolveCreditEffectiveAction(policy, violations);

  const allTitles = await prisma.customerCreditTitle.findMany({
    where: { organizationId: params.organizationId, customerId: cust.id },
    orderBy: [{ dueDate: "asc" }],
    take: 80,
  });

  const today0 = startOfToday(new Date());
  const check = await checkCustomer(
    params.organizationId,
    cust.id,
    params.previewAmount ?? null,
  );

  function serialize(t: (typeof allTitles)[number]) {
    const amt = decToNum(t.amount);
    const paid = decToNum(t.paidAmount);
    const remaining =
      t.status === "OPEN" ? Math.max(0, roundMoney(amt - paid)) : 0;
    const overdue =
      t.status === "OPEN" && remaining > EPS && t.dueDate < today0;
    return {
      id: t.id,
      reference: t.reference,
      amount: amt,
      paidAmount: paid,
      remaining,
      issueDate: t.issueDate.toISOString(),
      dueDate: t.dueDate.toISOString(),
      overdue,
      status: t.status,
      notes: t.notes,
    };
  }

  const serialized = allTitles.map(serialize);
  const titlesOpen = serialized.filter((x) => x.status === "OPEN");
  const titlesHistory = serialized
    .filter((x) => x.status !== "OPEN")
    .slice(0, 25);

  return {
    customerId: cust.id,
    creditBlocked: cust.creditBlocked,
    creditLimit:
      cust.creditLimit != null ? roundMoney(decToNum(cust.creditLimit)) : null,
    creditPolicy: org?.creditPolicy ?? "WARN_ONLY",
    openBalance: check.openAmount ?? 0,
    overdueCount:
      (check.overdueReceivables?.length ?? 0) +
      titlesOpen.filter((x) => x.overdue).length,
    overdueAmount: check.overdueAmount ?? 0,
    violations,
    effectiveAction,
    titlesOpen,
    titlesHistory,
    creditCheck: check,
  };
}
