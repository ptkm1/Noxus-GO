import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";
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

export type CustomersPdfFilters = {
  organizationId: string;
  sellerId?: string;
  customerId?: string;
  creditStatus?: "blocked" | "ok";
  extras?: Record<string, string>;
};

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
  if (filters.sellerId) where.sellerId = filters.sellerId;
  if (filters.customerId) where.id = filters.customerId;
  if (filters.creditStatus === "blocked") where.creditBlocked = true;
  if (filters.creditStatus === "ok") where.creditBlocked = false;
  if (filters.extras) applyCustomerExtras(where, filters.extras);

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
