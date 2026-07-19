import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";
import {
  calendarMonthBounds,
  sellerCommissionEarnedInPeriod,
  sellerConfirmedRevenueInPeriod,
  sellerRankingForPeriod,
} from "./seller-metrics.js";
import {
  getProgressiveTierRowsForSeller,
  resolveCommissionBaselinePercent,
  resolveProgressiveCommissionPercent,
} from "./commission-resolve.js";
import {
  goalAchievedAmount,
  resolveApplicableGoalForSeller,
} from "./seller-monthly-goals.js";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function buildSellerCommissionDashboard(
  organizationId: string,
  sellerId: string,
  referenceDate: Date,
) {
  const period = calendarMonthBounds(referenceDate);
  const { start, end, year, month } = period;

  const mtdRevenue = await sellerConfirmedRevenueInPeriod(organizationId, sellerId, start, end);
  const mtdCommissionRecorded = await sellerCommissionEarnedInPeriod(
    organizationId,
    sellerId,
    start,
    end,
  );

  const baselinePercent = await resolveCommissionBaselinePercent(
    organizationId,
    sellerId,
    mtdRevenue,
  );

  const ladder = await getProgressiveTierRowsForSeller(organizationId, sellerId);

  let activeTier: (typeof ladder)[number] | null = null;
  for (const step of ladder) {
    if (mtdRevenue + 1e-6 >= step.thresholdAmount) activeTier = step;
  }

  let nextTier: (typeof ladder)[number] | null = null;
  let gapToNextAmount: number | null = null;
  if (ladder.length) {
    if (!activeTier) {
      nextTier = ladder[0];
      gapToNextAmount = roundMoney(Math.max(0, ladder[0].thresholdAmount - mtdRevenue));
    } else {
      const idx = ladder.findIndex((x) => x.id === activeTier!.id);
      if (idx >= 0 && idx < ladder.length - 1) {
        nextTier = ladder[idx + 1];
        gapToNextAmount = roundMoney(Math.max(0, nextTier.thresholdAmount - mtdRevenue));
      }
    }
  }

  const effectiveProgressivePercent =
    ladder.length > 0 ? await resolveProgressiveCommissionPercent(organizationId, sellerId, mtdRevenue) : null;

  const productRulesCount = await prisma.sellerCommissionRule.count({
    where: { organizationId, sellerId, active: true, productId: { not: null } },
  });
  const categoryRulesCount = await prisma.sellerCommissionRule.count({
    where: {
      organizationId,
      sellerId,
      active: true,
      productId: null,
      categoryId: { not: null },
    },
  });
  const generalRulesCount = await prisma.sellerCommissionRule.count({
    where: {
      organizationId,
      sellerId,
      active: true,
      productId: null,
      categoryId: null,
    },
  });

  const goal = await resolveApplicableGoalForSeller(
    organizationId,
    sellerId,
    year,
    month,
  );

  const goalTarget = goal ? decToNum(goal.targetAmount) : null;
  const achievedAmount = goal
    ? await goalAchievedAmount(organizationId, goal, start, end)
    : mtdRevenue;
  const goalProgressPercent =
    goalTarget != null && goalTarget > 0
      ? roundMoney(Math.min(100, (achievedAmount / goalTarget) * 100))
      : null;

  const rankingFull = await sellerRankingForPeriod(organizationId, start, end);
  const myRow = rankingFull.find((r) => r.sellerId === sellerId);
  const top = rankingFull.slice(0, 10).map((r) => ({
    rank: r.rank,
    name: r.name,
    totalAmount: r.totalAmount,
    isMe: r.sellerId === sellerId,
  }));

  const periodLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));

  return {
    period: { year, month, label: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1) },
    mtd: {
      confirmedRevenue: mtdRevenue,
      commissionRecorded: mtdCommissionRecorded,
    },
    rulesSummary: {
      productRulesCount,
      categoryRulesCount,
      generalRulesCount,
      progressiveTierCount: ladder.length,
    },
    baselineCommissionPercent: baselinePercent,
    progressive: {
      ladder: ladder.map((t) => ({
        ...t,
        achieved: mtdRevenue + 1e-6 >= t.thresholdAmount,
      })),
      activeTier: activeTier ? { ...activeTier, achieved: true } : null,
      nextTier: nextTier ? { ...nextTier, achieved: false } : null,
      gapToNextAmount,
      effectivePercent: effectiveProgressivePercent,
    },
    goal: goal
      ? {
          title: goal.title,
          scope: goal.scope,
          scopeLabel:
            goal.scope === "SELLER"
              ? "Vendedor"
              : goal.scope === "TEAM"
                ? goal.team?.name
                  ? `Equipe ${goal.team.name}`
                  : "Equipe"
                : "Todos os vendedores",
          targetAmount: goalTarget,
          progressPercent: goalProgressPercent,
          achievedAmount,
        }
      : null,
    ranking: {
      position: myRow?.rank ?? null,
      totalSellers: rankingFull.length,
      myAmount: myRow?.totalAmount ?? mtdRevenue,
      top,
    },
  };
}
