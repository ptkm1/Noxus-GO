import type { CreditPolicy, CreditTitleStatus, Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";
import {
  getSellerShowUnassignedCustomers,
  sellerCustomerSellableWhere,
} from "./seller-customer-access.js";

export type CreditViolation = { code: string; message: string };

export type CreditEffectiveAction = "ALLOW" | "BLOCK" | "APPROVAL";

const EPS = 1e-6;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function startOfToday(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate(), 0, 0, 0, 0);
}

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

  const titles = await prisma.customerCreditTitle.findMany({
    where: {
      organizationId,
      customerId,
      status: "OPEN",
    },
  });

  let openBalance = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  const today0 = startOfToday(new Date());

  for (const t of titles) {
    const amt = decToNum(t.amount);
    const paid = decToNum(t.paidAmount);
    const remaining = roundMoney(amt - paid);
    if (remaining <= EPS) continue;
    openBalance = roundMoney(openBalance + remaining);
    if (t.dueDate < today0) {
      overdueAmount = roundMoney(overdueAmount + remaining);
      overdueCount++;
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
    violations.push({
      code: "OVERDUE_TITLES",
      message: `Há ${overdueCount} título(s) vencido(s) em aberto (total vencido R$ ${overdueAmount.toFixed(2).replace(".", ",")}).`,
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

  let overdueAmount = 0;
  let overdueCount = 0;
  let openBalance = 0;
  for (const x of titlesOpen) {
    openBalance += x.remaining;
    if (x.overdue) {
      overdueCount++;
      overdueAmount += x.remaining;
    }
  }
  openBalance = roundMoney(openBalance);
  overdueAmount = roundMoney(overdueAmount);

  return {
    customerId: cust.id,
    creditBlocked: cust.creditBlocked,
    creditLimit:
      cust.creditLimit != null ? roundMoney(decToNum(cust.creditLimit)) : null,
    creditPolicy: org?.creditPolicy ?? "WARN_ONLY",
    openBalance,
    overdueCount,
    overdueAmount,
    violations,
    effectiveAction,
    titlesOpen,
    titlesHistory,
  };
}
