import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";
import { CHURN_CUSTOMER_DAYS } from "../distributor-insights.js";
import { applyCustomerExtras } from "./extra-filters.js";
import {
    drawEmptyState,
    drawHeader,
    drawTableFooter,
    drawTableHeader,
    drawTableRow,
    money,
    type PdfTable,
    withPdfDoc,
} from "./pdf-common.js";

export type CustomerSituationFilter =
  | "blocked"
  | "ok"
  | "inactive"
  | "no_quarter_positivacao";

export type CustomersPdfFilters = {
  organizationId: string;
  sellerId?: string;
  /** Carteira / escopo multi-vendedor (líder / admin filtrado). */
  sellerIds?: string[];
  customerId?: string;
  /** @deprecated use `situation` */
  creditStatus?: "blocked" | "ok";
  situation?: CustomerSituationFilter;
  extras?: Record<string, string>;
};

const DAY_MS = 86_400_000;
const SP_TZ = "America/Sao_Paulo";

/** YYYY-MM-DD em America/Sao_Paulo. */
function saoPauloDayKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * Trimestre civil em America/Sao_Paulo (UTC−3 fixo desde 2019).
 * Q1=jan–mar, Q2=abr–jun, Q3=jul–set, Q4=out–dez.
 */
export function calendarQuarterBoundsSaoPaulo(
  at: Date = new Date(),
): { start: Date; end: Date } {
  const [yStr, mStr] = saoPauloDayKey(at).split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
  // midnight SP = 03:00 UTC
  const start = new Date(Date.UTC(y, qStartMonth - 1, 1, 3, 0, 0, 0));
  const nextQMonth = qStartMonth + 3;
  const endYear = nextQMonth > 12 ? y + 1 : y;
  const endMonth = nextQMonth > 12 ? nextQMonth - 12 : nextQMonth;
  const end = new Date(
    new Date(Date.UTC(endYear, endMonth - 1, 1, 3, 0, 0, 0)).getTime() - 1,
  );
  return { start, end };
}

function andWhere(
  where: Prisma.CustomerWhereInput,
  clause: Prisma.CustomerWhereInput,
) {
  const prev = where.AND;
  const list = Array.isArray(prev) ? prev : prev ? [prev] : [];
  where.AND = [...list, clause];
}

const TABLE: PdfTable = {
  columns: [
    { key: "name", label: "Nome", width: 125 },
    { key: "doc", label: "Documento", width: 95 },
    { key: "city", label: "Cidade/UF", width: 85 },
    { key: "seller", label: "Vendedor", width: 85 },
    { key: "phone", label: "Telefone", width: 75 },
    { key: "credit", label: "Crédito", width: 82, align: "right" },
  ],
  rowHeight: 22,
};

export async function buildCustomersPdf(
  filters: CustomersPdfFilters,
): Promise<Buffer> {
  const where: Prisma.CustomerWhereInput = {
    organizationId: filters.organizationId,
  };
  if (filters.sellerIds?.length) {
    where.sellerId = { in: filters.sellerIds };
  } else if (filters.sellerId) {
    where.sellerId = filters.sellerId;
  }
  if (filters.customerId) where.id = filters.customerId;

  const situation: CustomerSituationFilter | undefined =
    filters.situation ??
    (filters.creditStatus === "blocked" || filters.creditStatus === "ok"
      ? filters.creditStatus
      : undefined);

  if (situation === "blocked") where.creditBlocked = true;
  if (situation === "ok") where.creditBlocked = false;

  if (situation === "inactive") {
    // Mesmo critério de churn em distributor-insights: sem pedido confirmado
    // nos últimos CHURN_CUSTOMER_DAYS, excluindo cadastros recentes (grace).
    const cutoff = new Date(Date.now() - CHURN_CUSTOMER_DAYS * DAY_MS);
    andWhere(where, {
      createdAt: { lte: cutoff },
      orders: {
        none: {
          status: "CONFIRMED",
          createdAt: { gte: cutoff },
        },
      },
    });
  }

  if (situation === "no_quarter_positivacao") {
    const { start, end } = calendarQuarterBoundsSaoPaulo();
    andWhere(where, {
      orders: {
        none: {
          status: "CONFIRMED",
          createdAt: { gte: start, lte: end },
        },
      },
    });
  }

  if (filters.extras) {
    await applyCustomerExtras(where, filters.extras, filters.organizationId);
  }

  const [org, customers] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: filters.organizationId },
      select: { name: true, displayName: true },
    }),
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        seller: { include: { user: { select: { name: true } } } },
      },
    }),
  ]);

  const orgName = org?.displayName || org?.name || "";

  return withPdfDoc((doc) => {
    drawHeader(
      doc,
      "Relatório de Clientes",
      orgName,
      `${customers.length} cliente(s) · ${new Date().toLocaleString("pt-BR")}`,
    );

    if (customers.length === 0) {
      drawEmptyState(doc, "Nenhum cliente encontrado para os filtros.");
      return;
    }

    drawTableHeader(doc, TABLE);

    customers.forEach((c, index) => {
      const docLabel =
        c.cnpj || c.cpf
          ? c.documentType === "CNPJ"
            ? (c.cnpj ?? "—")
            : (c.cpf ?? "—")
          : "—";
      const cityUf = [c.city, c.state].filter(Boolean).join("/") || "—";
      const limit =
        c.creditLimit != null ? money(decToNum(c.creditLimit)) : "—";
      const credit = c.creditBlocked ? `BLOQ · ${limit}` : `OK · ${limit}`;

      drawTableRow(
        doc,
        TABLE,
        {
          name: c.name,
          doc: docLabel,
          city: cityUf,
          seller: c.seller?.user.name ?? "—",
          phone: c.phone ?? "—",
          credit,
        },
        {
          index,
          onNewPage: () =>
            drawHeader(
              doc,
              "Relatório de Clientes (cont.)",
              orgName,
              `${customers.length} cliente(s)`,
            ),
        },
      );
    });

    drawTableFooter(
      doc,
      `Total de clientes: ${customers.length}`,
      `${customers.filter((c) => c.creditBlocked).length} bloqueado(s)`,
    );
  });
}
