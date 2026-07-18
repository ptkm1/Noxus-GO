import { getMapsFeaturesConfig } from "../config/maps-features.js";

export type RoutesQuotaPeek = {
  allowed: boolean;
  remaining: number;
  limit: number;
  usedOrg: number;
  usedGlobal: number;
  reason?: string;
};

type DayCounters = { dateKey: string; orgCount: number };
type GlobalCounter = { dateKey: string; count: number };

const orgCounters = new Map<string, DayCounters>();
let globalCounter: GlobalCounter = { dateKey: "", count: 0 };

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function effectiveOrgLimit(): number {
  const cfg = getMapsFeaturesConfig();
  if (!cfg.googleRoutesEnabled) return 0;
  return cfg.googleRoutesDailyMaxPerOrg;
}

function effectiveGlobalLimit(): number {
  const cfg = getMapsFeaturesConfig();
  if (!cfg.googleRoutesEnabled) return 0;
  return cfg.googleRoutesDailyMaxGlobal;
}

function getOrgUsed(organizationId: string, dateKey: string): number {
  const row = orgCounters.get(organizationId);
  if (!row || row.dateKey !== dateKey) return 0;
  return row.orgCount;
}

function getGlobalUsed(dateKey: string): number {
  if (globalCounter.dateKey !== dateKey) return 0;
  return globalCounter.count;
}

/** Inspeção sem consumir cota (para respostas admin). */
export function peekRoutesQuota(organizationId: string): RoutesQuotaPeek {
  const cfg = getMapsFeaturesConfig();
  const dateKey = utcDateKey();

  if (!cfg.googleRoutesEnabled) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      usedOrg: getOrgUsed(organizationId, dateKey),
      usedGlobal: getGlobalUsed(dateKey),
      reason: "GOOGLE_ROUTES_ENABLED=false",
    };
  }

  if (!cfg.googleRoutesHasApiKey) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      usedOrg: 0,
      usedGlobal: 0,
      reason: "GOOGLE_MAPS_SERVER_API_KEY ausente",
    };
  }

  const orgLimit = effectiveOrgLimit();
  const globalLimit = effectiveGlobalLimit();
  const usedOrg = getOrgUsed(organizationId, dateKey);
  const usedGlobal = getGlobalUsed(dateKey);

  if (orgLimit <= 0) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      usedOrg,
      usedGlobal,
      reason: "GOOGLE_ROUTES_DAILY_MAX_PER_ORG=0",
    };
  }

  if (globalLimit > 0 && usedGlobal >= globalLimit) {
    return {
      allowed: false,
      remaining: 0,
      limit: orgLimit,
      usedOrg,
      usedGlobal,
      reason: "Limite global diário de Routes atingido",
    };
  }

  if (usedOrg >= orgLimit) {
    return {
      allowed: false,
      remaining: 0,
      limit: orgLimit,
      usedOrg,
      usedGlobal,
      reason: "Limite diário de Routes da organização atingido",
    };
  }

  return {
    allowed: true,
    remaining: orgLimit - usedOrg,
    limit: orgLimit,
    usedOrg,
    usedGlobal,
  };
}

/** Consome 1 unidade de cota antes de chamar a Google Routes API. */
export function tryConsumeRoutesQuota(organizationId: string): RoutesQuotaPeek {
  const peek = peekRoutesQuota(organizationId);
  if (!peek.allowed) return peek;

  const dateKey = utcDateKey();
  const orgLimit = effectiveOrgLimit();
  const globalLimit = effectiveGlobalLimit();

  const prevOrg = orgCounters.get(organizationId);
  const orgCount = (prevOrg?.dateKey === dateKey ? prevOrg.orgCount : 0) + 1;
  orgCounters.set(organizationId, { dateKey, orgCount });

  if (globalLimit > 0) {
    const gCount = (globalCounter.dateKey === dateKey ? globalCounter.count : 0) + 1;
    globalCounter = { dateKey, count: gCount };
  }

  return {
    allowed: true,
    remaining: Math.max(0, orgLimit - orgCount),
    limit: orgLimit,
    usedOrg: orgCount,
    usedGlobal: globalLimit > 0 ? (globalCounter.dateKey === dateKey ? globalCounter.count : 0) : 0,
  };
}

export function buildMapsFeaturesPayload(organizationId: string) {
  const cfg = getMapsFeaturesConfig();
  const quota = peekRoutesQuota(organizationId);
  return {
    googleRoutesEnabled: cfg.googleRoutesEnabled,
    googleRoutesHasApiKey: cfg.googleRoutesHasApiKey,
    googleRoutesDailyMaxPerOrg: cfg.googleRoutesDailyMaxPerOrg,
    googleRoutesDailyMaxGlobal: cfg.googleRoutesDailyMaxGlobal,
    googleRoutesRemaining: quota.remaining,
    googleRoutesQuotaAllowed: quota.allowed,
    googleRoutesQuotaReason: quota.reason ?? null,
  };
}
