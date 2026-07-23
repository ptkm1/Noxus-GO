import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";
import { notifyUsers } from "./notify.js";
import { goalAchievedAmount } from "./seller-monthly-goals.js";

const TZ = "America/Sao_Paulo";
/** Queda mínima (7d vs 7d anterior) para tip de vendas. */
const SALES_DROP_PCT = 15;
/** Clientes sem compra confirmada há N dias. */
const COLD_CUSTOMER_DAYS = 30;
/** Meta atrasada se progresso < % esperado do mês − este gap. */
const GOAL_LAG_PP = 10;

export type MorningBriefTipSeverity = "info" | "warning" | "critical";

export type MorningBriefTip = {
  id: string;
  severity: MorningBriefTipSeverity;
  title: string;
  reason: string;
  href?: string;
};

export type MorningBrief = {
  date: string;
  generatedAt: string;
  cached: boolean;
  tips: MorningBriefTip[];
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtMoney(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/** YYYY-MM-DD no fuso America/Sao_Paulo. */
export function saoPauloDayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Date @db.Date a partir da chave YYYY-MM-DD. */
export function dayKeyToDate(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

/**
 * Limites do dia civil em America/Sao_Paulo (UTC−3 fixo desde 2019).
 * midnight SP = 03:00 UTC.
 */
export function saoPauloDayBounds(dayKey: string): { start: Date; end: Date } {
  const start = new Date(`${dayKey}T03:00:00.000Z`);
  const next = addCalendarDays(dayKey, 1);
  const end = new Date(new Date(`${next}T03:00:00.000Z`).getTime() - 1);
  return { start, end };
}

function addCalendarDays(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d! + delta));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function saoPauloYearMonth(dayKey: string): {
  year: number;
  month: number;
  day: number;
} {
  const [y, m, d] = dayKey.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

async function computeTips(
  organizationId: string,
  dayKey: string,
): Promise<MorningBriefTip[]> {
  const todayBounds = saoPauloDayBounds(dayKey);
  const { year, month, day } = saoPauloYearMonth(dayKey);

  // Últimos 7 dias civis completos antes de hoje, vs. os 7 anteriores.
  const last7StartKey = addCalendarDays(dayKey, -7);
  const prev7StartKey = addCalendarDays(dayKey, -14);
  const last7 = {
    start: saoPauloDayBounds(last7StartKey).start,
    end: new Date(todayBounds.start.getTime() - 1),
  };
  const prev7 = {
    start: saoPauloDayBounds(prev7StartKey).start,
    end: new Date(saoPauloDayBounds(last7StartKey).start.getTime() - 1),
  };

  const monthStartKey = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthStart = saoPauloDayBounds(monthStartKey).start;
  const coldCutoff = new Date(
    todayBounds.start.getTime() - COLD_CUSTOMER_DAYS * 86_400_000,
  );

  const [
    last7Agg,
    prev7Agg,
    eligibleCustomers,
    recentBuyerRows,
    products,
    overdueTitles,
    pendingApprovals,
    orgGoal,
    fiscalConfig,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: {
        organizationId,
        status: "CONFIRMED",
        createdAt: { gte: last7.start, lte: last7.end },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        organizationId,
        status: "CONFIRMED",
        createdAt: { gte: prev7.start, lte: prev7.end },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.customer.count({
      where: {
        organizationId,
        approvalStatus: "APPROVED",
        createdAt: { lte: coldCutoff },
      },
    }),
    prisma.order.findMany({
      where: {
        organizationId,
        status: "CONFIRMED",
        createdAt: { gte: coldCutoff },
        customerId: { not: null },
        customer: {
          approvalStatus: "APPROVED",
          createdAt: { lte: coldCutoff },
        },
      },
      distinct: ["customerId"],
      select: { customerId: true },
    }),
    prisma.product.findMany({
      where: { organizationId },
      select: {
        stockQty: true,
        minStockQty: true,
        productStock: { select: { quantityOnHand: true } },
      },
    }),
    prisma.customerCreditTitle.findMany({
      where: {
        organizationId,
        status: "OPEN",
        dueDate: { lt: todayBounds.start },
      },
      select: { amount: true, paidAmount: true },
    }),
    prisma.customer.count({
      where: { organizationId, approvalStatus: "PENDING" },
    }),
    prisma.sellerMonthlyGoal.findFirst({
      where: {
        organizationId,
        year,
        month,
        scope: "ALL",
      },
    }),
    prisma.organizationFiscalConfig.findUnique({
      where: { organizationId },
      select: { certificateExpiresAt: true, certificatePfxEncrypted: true },
    }),
  ]);

  const tips: MorningBriefTip[] = [];

  if (fiscalConfig?.certificatePfxEncrypted) {
    const { certificateStatus } = await import("../fiscal/certificate.js");
    const cert = certificateStatus(fiscalConfig.certificateExpiresAt);
    if (cert.alertThreshold != null) {
      const days = cert.daysUntilExpiry ?? 0;
      tips.push({
        id: "cert_expiry",
        severity:
          cert.alertThreshold === 0 || cert.alertThreshold <= 7
            ? "critical"
            : cert.alertThreshold <= 15
              ? "warning"
              : "info",
        title:
          cert.alertThreshold === 0
            ? "Certificado digital A1 vencido"
            : `Certificado A1 vence em ${days} dia(s)`,
        reason:
          cert.alertThreshold === 0
            ? "O certificado NF-e está vencido. Emissões e eventos SEFAZ vão falhar até renovar em Faturamento → Configurações."
            : `Faltam ${days} dias para o vencimento do certificado A1 (alerta em ${cert.alertThreshold} dias). Renove em Faturamento → Configurações.`,
        href: "/faturamento",
      });
    }
  }

  const last7Rev = roundMoney(decToNum(last7Agg._sum.totalAmount ?? 0));
  const prev7Rev = roundMoney(decToNum(prev7Agg._sum.totalAmount ?? 0));
  if (prev7Rev > 0) {
    const dropPct = ((prev7Rev - last7Rev) / prev7Rev) * 100;
    if (dropPct >= SALES_DROP_PCT) {
      tips.push({
        id: "sales_drop",
        severity: dropPct >= 30 ? "critical" : "warning",
        title: "Queda nas vendas (7 dias)",
        reason: `Faturamento dos últimos 7 dias (R$ ${fmtMoney(last7Rev)}) ficou ${Math.round(dropPct)}% abaixo dos 7 dias anteriores (R$ ${fmtMoney(prev7Rev)}).`,
        href: "/insights",
      });
    }
  } else if (last7Rev === 0 && prev7Rev === 0 && last7Agg._count === 0) {
    tips.push({
      id: "sales_quiet",
      severity: "info",
      title: "Sem vendas confirmadas recentes",
      reason:
        "Não há pedidos confirmados nos últimos 14 dias. Vale checar a operação da equipe.",
      href: "/insights",
    });
  }

  const coldCount = Math.max(0, eligibleCustomers - recentBuyerRows.length);
  if (coldCount > 0) {
    tips.push({
      id: "cold_portfolio",
      severity: coldCount >= 20 ? "critical" : "warning",
      title: "Carteira fria",
      reason: `${coldCount} cliente(s) aprovado(s) sem compra confirmada há ${COLD_CUSTOMER_DAYS}+ dias.`,
      href: "/clientes",
    });
  }

  let zeroStock = 0;
  let belowMin = 0;
  for (const p of products) {
    const qty =
      p.productStock != null
        ? Number(p.productStock.quantityOnHand)
        : p.stockQty;
    if (qty <= 0) zeroStock += 1;
    else if (p.minStockQty > 0 && qty < p.minStockQty) belowMin += 1;
  }
  const stockIssues = zeroStock + belowMin;
  if (stockIssues > 0) {
    tips.push({
      id: "low_stock",
      severity: zeroStock >= 10 ? "critical" : "warning",
      title: "Estoque baixo ou zerado",
      reason:
        zeroStock > 0 && belowMin > 0
          ? `${zeroStock} produto(s) zerado(s) e ${belowMin} abaixo do mínimo.`
          : zeroStock > 0
            ? `${zeroStock} produto(s) com estoque zerado.`
            : `${belowMin} produto(s) abaixo do estoque mínimo.`,
      href: "/estoque",
    });
  }

  let overdueOpen = 0;
  let overdueAmount = 0;
  for (const t of overdueTitles) {
    const open = Math.max(0, decToNum(t.amount) - decToNum(t.paidAmount));
    if (open <= 0) continue;
    overdueOpen += 1;
    overdueAmount += open;
  }
  overdueAmount = roundMoney(overdueAmount);
  if (overdueOpen > 0) {
    tips.push({
      id: "overdue_credit",
      severity: overdueOpen >= 10 ? "critical" : "warning",
      title: "Títulos de crédito vencidos",
      reason: `${overdueOpen} título(s) em aberto vencido(s), totalizando R$ ${fmtMoney(overdueAmount)}.`,
      href: "/relatorios/gestao",
    });
  }

  if (pendingApprovals > 0) {
    tips.push({
      id: "pending_approvals",
      severity: "warning",
      title: "Cadastros aguardando aprovação",
      reason: `${pendingApprovals} cliente(s) pendente(s) de validação pelo escritório.`,
      href: "/clientes#pendentes",
    });
  }

  if (orgGoal) {
    const target = decToNum(orgGoal.targetAmount);
    if (target > 0) {
      const achieved = await goalAchievedAmount(
        organizationId,
        orgGoal,
        monthStart,
        todayBounds.end,
      );
      const progressPct = (achieved / target) * 100;
      const expectedPct = (day / daysInMonth(year, month)) * 100;
      if (progressPct + GOAL_LAG_PP < expectedPct) {
        tips.push({
          id: "goal_lag",
          severity: progressPct < expectedPct * 0.5 ? "critical" : "warning",
          title: "Meta do mês atrás do ritmo",
          reason: `Meta geral em ${Math.round(progressPct)}% (R$ ${fmtMoney(achieved)} de R$ ${fmtMoney(target)}); o mês já avançou ~${Math.round(expectedPct)}%.`,
          href: "/comissao/metas",
        });
      }
    }
  }

  if (tips.length === 0) {
    tips.push({
      id: "all_clear",
      severity: "info",
      title: "Nada crítico pela manhã",
      reason:
        "Vendas recentes, carteira, estoque, crédito e aprovações estão dentro dos critérios automáticos.",
      href: "/insights",
    });
  }

  return tips;
}

function rowToBrief(
  row: { date: Date; tips: unknown; generatedAt: Date },
  cached: boolean,
): MorningBrief {
  const date =
    row.date instanceof Date
      ? row.date.toISOString().slice(0, 10)
      : String(row.date).slice(0, 10);
  return {
    date,
    generatedAt: row.generatedAt.toISOString(),
    cached,
    tips: Array.isArray(row.tips) ? (row.tips as MorningBriefTip[]) : [],
  };
}

/**
 * Retorna o brief do dia (America/Sao_Paulo). Gera e persiste se ainda não existir.
 */
export async function getOrCreateMorningBrief(
  organizationId: string,
  now: Date = new Date(),
): Promise<MorningBrief> {
  const dayKey = saoPauloDayKey(now);
  const date = dayKeyToDate(dayKey);

  const existing = await prisma.organizationDailyInsight.findUnique({
    where: {
      organizationId_date: { organizationId, date },
    },
  });
  if (existing) return rowToBrief(existing, true);

  const tips = await computeTips(organizationId, dayKey);

  try {
    const created = await prisma.organizationDailyInsight.create({
      data: {
        organizationId,
        date,
        tips: tips as unknown as Prisma.InputJsonValue,
      },
    });
    return rowToBrief(created, false);
  } catch (err) {
    // Corrida: outro request/job criou no mesmo instante.
    const raced = await prisma.organizationDailyInsight.findUnique({
      where: {
        organizationId_date: { organizationId, date },
      },
    });
    if (raced) return rowToBrief(raced, true);
    throw err;
  }
}

export type MorningBriefJobResult = {
  organizations: number;
  generated: number;
  alreadyCached: number;
  notified: number;
};

/**
 * Gera o brief de hoje para todas as orgs (ou uma) e notifica ADMIN/MANAGER
 * uma vez por dia quando o brief é novo.
 */
export async function runMorningBriefJob(params?: {
  organizationId?: string;
  notify?: boolean;
}): Promise<MorningBriefJobResult> {
  const notify = params?.notify !== false;
  const orgs = await prisma.organization.findMany({
    where: params?.organizationId ? { id: params.organizationId } : undefined,
    select: { id: true },
  });

  let generated = 0;
  let alreadyCached = 0;
  let notified = 0;
  const dayKey = saoPauloDayKey();
  const date = dayKeyToDate(dayKey);

  for (const org of orgs) {
    const before = await prisma.organizationDailyInsight.findUnique({
      where: {
        organizationId_date: { organizationId: org.id, date },
      },
    });
    const brief = await getOrCreateMorningBrief(org.id);
    if (before) {
      alreadyCached += 1;
    } else {
      generated += 1;
    }

    if (!notify) continue;

    const row = await prisma.organizationDailyInsight.findUnique({
      where: {
        organizationId_date: { organizationId: org.id, date },
      },
    });
    if (!row || row.notifiedAt) continue;

    const recipients = await prisma.user.findMany({
      where: {
        organizationId: org.id,
        role: { in: ["ADMIN", "MANAGER"] },
      },
      select: { id: true },
    });
    if (!recipients.length) {
      await prisma.organizationDailyInsight.update({
        where: { id: row.id },
        data: { notifiedAt: new Date() },
      });
      continue;
    }

    const actionable = brief.tips.filter((t) => t.id !== "all_clear");
    const title = "Resumo da manhã";
    const body =
      actionable.length > 0
        ? `${actionable.length} ponto(s) de atenção hoje. Abra Insights.`
        : "Nada crítico pela manhã. Bom dia!";

    await notifyUsers({
      userIds: recipients.map((u) => u.id),
      title,
      body,
      type: "MORNING_BRIEF",
      data: { href: "/insights", tipCount: actionable.length },
    });

    await prisma.organizationDailyInsight.update({
      where: { id: row.id },
      data: { notifiedAt: new Date() },
    });
    notified += 1;
  }

  return {
    organizations: orgs.length,
    generated,
    alreadyCached,
    notified,
  };
}
