import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

/** Escopo de clientes visíveis ao vendedor (próprios ± sem dono, conforme política da org). */
export function sellerCustomerAccessWhere(
  organizationId: string,
  sellerId: string,
  showUnassigned: boolean,
): Prisma.CustomerWhereInput {
  if (showUnassigned) {
    return {
      organizationId,
      OR: [{ sellerId }, { sellerId: null }],
    };
  }
  return { organizationId, sellerId };
}

/** Clientes aprovados no escopo do vendedor — vendas, rota, crédito. */
export function sellerCustomerSellableWhere(
  organizationId: string,
  sellerId: string,
  showUnassigned: boolean,
): Prisma.CustomerWhereInput {
  return {
    ...sellerCustomerAccessWhere(organizationId, sellerId, showUnassigned),
    approvalStatus: "APPROVED",
  };
}

/** Mesmo filtro de venda/rota, com visão org inteira para ADMIN no app mobile. */
export function mobileCustomerSellableWhere(
  organizationId: string,
  sellerId: string | null,
  role: "ADMIN" | "SELLER" | "MANAGER" | "SUPERVISOR",
  showUnassigned: boolean,
): Prisma.CustomerWhereInput {
  if (role === "ADMIN") {
    return { organizationId, approvalStatus: "APPROVED" };
  }
  return sellerCustomerSellableWhere(organizationId, sellerId!, showUnassigned);
}

/**
 * Lista do app: aprovados no escopo + pendentes/rejeitados criados pelo próprio vendedor
 * (para acompanhar validação, sem misturar carteira alheia).
 */
export function sellerCustomerListWhere(
  organizationId: string,
  sellerId: string,
  showUnassigned: boolean,
): Prisma.CustomerWhereInput {
  return {
    organizationId,
    OR: [
      {
        approvalStatus: "APPROVED",
        ...(showUnassigned
          ? { OR: [{ sellerId }, { sellerId: null }] }
          : { sellerId }),
      },
      {
        sellerId,
        approvalStatus: { in: ["PENDING", "REJECTED"] },
      },
    ],
  };
}

export async function getSellerShowUnassignedCustomers(
  organizationId: string,
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { sellerShowUnassignedCustomers: true },
  });
  return org?.sellerShowUnassignedCustomers ?? true;
}

export async function getCustomerRegistrationMode(
  organizationId: string,
): Promise<"AUTO" | "REQUIRE_APPROVAL"> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { customerRegistrationMode: true },
  });
  return org?.customerRegistrationMode ?? "AUTO";
}
