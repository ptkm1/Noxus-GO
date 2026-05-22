export type MapsFeaturesSnapshot = {
  googleRoutesEnabled: boolean;
  googleRoutesHasApiKey: boolean;
  googleRoutesDailyMaxPerOrg: number;
  googleRoutesDailyMaxGlobal: number;
};

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null || raw.trim() === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return defaultValue;
}

function parseNonNegativeInt(raw: string | undefined, defaultValue: number): number {
  if (raw == null || raw.trim() === "") return defaultValue;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

export function getMapsFeaturesConfig(): MapsFeaturesSnapshot {
  return {
    googleRoutesEnabled: parseBool(process.env.GOOGLE_ROUTES_ENABLED, false),
    googleRoutesHasApiKey: !!process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim(),
    googleRoutesDailyMaxPerOrg: parseNonNegativeInt(process.env.GOOGLE_ROUTES_DAILY_MAX_PER_ORG, 0),
    googleRoutesDailyMaxGlobal: parseNonNegativeInt(process.env.GOOGLE_ROUTES_DAILY_MAX_GLOBAL, 0),
  };
}
