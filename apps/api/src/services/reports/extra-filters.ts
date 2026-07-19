import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

/** Lê query params `x_*` enviados pelos filtros adicionais da UI. */
export function readExtraParams(
  query: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (!k.startsWith("x_")) continue;
    const raw = Array.isArray(v) ? v[0] : v;
    if (typeof raw !== "string" || !raw.trim()) continue;
    out[k.slice(2)] = raw.trim();
  }
  return out;
}

/** Intersect `where.id` with ids (empty list → no matching rows). */
function intersectWhereIds(where: Prisma.CustomerWhereInput, ids: string[]) {
  if (typeof where.id === "string") {
    where.id = ids.includes(where.id) ? where.id : { in: [] };
    return;
  }
  where.id = { in: ids };
}

/**
 * Filter by comparing the column as text. Works whether the DB column is
 * `text` or a Postgres enum (avoids `operator does not exist: text = "Enum"`).
 */
async function restrictCustomerIdsByDocumentType(
  organizationId: string,
  documentType: "CNPJ" | "CPF",
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Customer"
    WHERE "organizationId" = ${organizationId}
      AND "documentType"::text = ${documentType}
  `;
  return rows.map((r) => r.id);
}

export async function applyCustomerExtras(
  where: Prisma.CustomerWhereInput,
  x: Record<string, string>,
  organizationId: string,
) {
  if (x.city) {
    where.city = { contains: x.city, mode: "insensitive" };
  }
  if (x.state) {
    where.state = { equals: x.state.toUpperCase(), mode: "insensitive" };
  }
  if (x.email) {
    where.email = { contains: x.email, mode: "insensitive" };
  }
  if (x.phone) {
    where.phone = { contains: x.phone, mode: "insensitive" };
  }
  if (x.documentType === "CNPJ" || x.documentType === "CPF") {
    // Prisma enum equality fails when the column is still `text` in PG.
    const ids = await restrictCustomerIdsByDocumentType(
      organizationId,
      x.documentType,
    );
    intersectWhereIds(where, ids);
  }
  if (x.tradeName) {
    where.tradeName = { contains: x.tradeName, mode: "insensitive" };
  }
  if (x.legalName) {
    where.legalName = { contains: x.legalName, mode: "insensitive" };
  }
}

export function applyOrderExtras(
  where: Prisma.OrderWhereInput,
  x: Record<string, string>,
) {
  if (x.notes) {
    where.notes = { contains: x.notes, mode: "insensitive" };
  }
  const amount: Prisma.DecimalFilter = {};
  if (
    x.totalMin != null &&
    x.totalMin !== "" &&
    !Number.isNaN(Number(x.totalMin))
  ) {
    amount.gte = Number(x.totalMin);
  }
  if (
    x.totalMax != null &&
    x.totalMax !== "" &&
    !Number.isNaN(Number(x.totalMax))
  ) {
    amount.lte = Number(x.totalMax);
  }
  if (Object.keys(amount).length) where.totalAmount = amount;
  if (x.isQuote === "1") where.isQuote = true;
  if (x.isQuote === "0") where.isQuote = false;
}

export type StockExtraFilters = {
  stockQtyMin?: number;
  stockQtyMax?: number;
  productLine?: string;
  blockSaleWhenOutOfStock?: boolean;
  hasExpiringSoon?: boolean;
};

export function parseStockExtras(x: Record<string, string>): StockExtraFilters {
  const out: StockExtraFilters = {};
  if (
    x.stockQtyMin != null &&
    x.stockQtyMin !== "" &&
    !Number.isNaN(Number(x.stockQtyMin))
  ) {
    out.stockQtyMin = Number(x.stockQtyMin);
  }
  if (
    x.stockQtyMax != null &&
    x.stockQtyMax !== "" &&
    !Number.isNaN(Number(x.stockQtyMax))
  ) {
    out.stockQtyMax = Number(x.stockQtyMax);
  }
  if (x.productLine) out.productLine = x.productLine;
  if (x.blockSaleWhenOutOfStock === "1") out.blockSaleWhenOutOfStock = true;
  if (x.blockSaleWhenOutOfStock === "0") out.blockSaleWhenOutOfStock = false;
  if (x.hasExpiringSoon === "1") out.hasExpiringSoon = true;
  if (x.hasExpiringSoon === "0") out.hasExpiringSoon = false;
  return out;
}
