import { prisma } from "../db.js";

/** Meses sem pedido confirmado para inativar (fixo da regra do produto). */
export const AUTO_INACTIVATE_CUSTOMER_MONTHS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

function cutoffDate(months: number = AUTO_INACTIVATE_CUSTOMER_MONTHS): Date {
  // Aproximação estável em dias (30 * meses), alinhada a relatórios de churn.
  return new Date(Date.now() - months * 30 * DAY_MS);
}

/** Reativa cliente inativo ao confirmar uma venda. */
export async function reactivateCustomerOnSale(
  customerId: string | null | undefined,
): Promise<void> {
  if (!customerId) return;
  await prisma.customer.updateMany({
    where: { id: customerId, status: "INACTIVE" },
    data: { status: "ACTIVE" },
  });
}

type InactivationResult = {
  organizationsProcessed: number;
  customersInactivated: number;
};

/**
 * Marca como INACTIVE clientes ACTIVE sem pedido CONFIRMED no período,
 * excluindo cadastros mais recentes que o cutoff (grace).
 */
export async function runCustomerInactivation(opts?: {
  organizationId?: string;
}): Promise<InactivationResult> {
  const orgs = await prisma.organization.findMany({
    where: {
      autoInactivateCustomersAfterMonths: true,
      ...(opts?.organizationId ? { id: opts.organizationId } : {}),
    },
    select: { id: true },
  });

  const cutoff = cutoffDate();
  let customersInactivated = 0;

  for (const org of orgs) {
    const result = await prisma.customer.updateMany({
      where: {
        organizationId: org.id,
        status: "ACTIVE",
        createdAt: { lte: cutoff },
        orders: {
          none: {
            status: "CONFIRMED",
            createdAt: { gte: cutoff },
          },
        },
      },
      data: { status: "INACTIVE" },
    });
    customersInactivated += result.count;
  }

  return {
    organizationsProcessed: orgs.length,
    customersInactivated,
  };
}

/**
 * Lazy: se a org tiver a regra ligada, aplica inativação só nessa org
 * (útil em dev sem cron / ao listar clientes).
 */
export async function maybeInactivateStaleCustomersForOrg(
  organizationId: string,
): Promise<number> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { autoInactivateCustomersAfterMonths: true },
  });
  if (!org?.autoInactivateCustomersAfterMonths) return 0;
  const result = await runCustomerInactivation({ organizationId });
  return result.customersInactivated;
}
