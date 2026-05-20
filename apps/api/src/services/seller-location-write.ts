import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";
import { broadcastSellerLocation } from "./seller-location-ws.js";

const MIN_MOVE_METERS = 35;
const MIN_HISTORY_INTERVAL_MS = 2 * 60_000;
const HISTORY_RETENTION_DAYS = Number(process.env.SELLER_LOCATION_HISTORY_DAYS ?? "7");
const PURGE_SAMPLE_RATE = 0.01;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

async function maybePurgeOldHistory(organizationId: string): Promise<void> {
  if (Math.random() > PURGE_SAMPLE_RATE) return;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_RETENTION_DAYS);
  await prisma.sellerLocationHistory.deleteMany({
    where: { organizationId, recordedAt: { lt: cutoff } },
  });
}

async function maybeAppendHistory(
  sellerId: string,
  organizationId: string,
  latitude: number,
  longitude: number,
  accuracyMeters: number | undefined,
  recordedAt: Date,
): Promise<void> {
  const last = await prisma.sellerLocationHistory.findFirst({
    where: { sellerId },
    orderBy: { recordedAt: "desc" },
    select: { latitude: true, longitude: true, recordedAt: true },
  });

  const dayStart = startOfUtcDay(recordedAt);
  const firstToday = await prisma.sellerLocationHistory.findFirst({
    where: { sellerId, recordedAt: { gte: dayStart } },
    select: { id: true },
  });

  let shouldWrite = !firstToday;
  if (!shouldWrite && last) {
    const lastLat = decToNum(last.latitude);
    const lastLng = decToNum(last.longitude);
    const moved = haversineMeters(lastLat, lastLng, latitude, longitude);
    const elapsed = recordedAt.getTime() - last.recordedAt.getTime();
    shouldWrite = moved >= MIN_MOVE_METERS || elapsed >= MIN_HISTORY_INTERVAL_MS;
  }

  if (!shouldWrite) return;

  await prisma.sellerLocationHistory.create({
    data: {
      sellerId,
      organizationId,
      latitude,
      longitude,
      accuracyMeters,
      recordedAt,
    },
  });
}

export type RecordSellerLocationInput = {
  sellerId: string;
  organizationId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
};

export async function recordSellerLocation(input: RecordSellerLocationInput): Promise<{
  recordedAt: string;
  sellerId: string;
  latitude: number;
  longitude: number;
  managerUserId: string | null;
}> {
  const recordedAt = new Date();
  const { sellerId, organizationId, latitude, longitude, accuracyMeters } = input;

  const [row, seller] = await Promise.all([
    prisma.sellerLiveLocation.upsert({
      where: { sellerId },
      create: {
        sellerId,
        organizationId,
        latitude,
        longitude,
        accuracyMeters,
        recordedAt,
      },
      update: {
        latitude,
        longitude,
        accuracyMeters,
        recordedAt,
      },
    }),
    prisma.seller.findUnique({
      where: { id: sellerId },
      select: { managerUserId: true },
    }),
  ]);

  await Promise.all([
    maybeAppendHistory(sellerId, organizationId, latitude, longitude, accuracyMeters, recordedAt),
    maybePurgeOldHistory(organizationId),
  ]);

  const payload = {
    type: "seller_location" as const,
    sellerId,
    latitude,
    longitude,
    accuracyMeters: accuracyMeters ?? null,
    recordedAt: row.recordedAt.toISOString(),
    managerUserId: seller?.managerUserId ?? null,
  };

  broadcastSellerLocation(organizationId, payload);

  return {
    recordedAt: row.recordedAt.toISOString(),
    sellerId,
    latitude,
    longitude,
    managerUserId: seller?.managerUserId ?? null,
  };
}
