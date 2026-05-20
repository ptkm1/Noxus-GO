import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";
import type { AccessPayload } from "../auth/jwt.js";
import { assertSellerInScope } from "../auth/org-roles.js";
import { isGoogleRoutesConfigured } from "./google-routes.js";
import { buildTrailRoadPolyline } from "./seller-trail-routes.js";
import type { FastifyReply } from "fastify";

const MAX_POINTS = 1500;

function parseVisitDay(raw: string | undefined): Date | null {
  const s = raw?.trim();
  if (!s) return null;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!day) return null;
  const y = Number(day[1]);
  const mo = Number(day[2]);
  const d = Number(day[3]);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

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

export async function getSellerLocationHistory(
  auth: AccessPayload,
  reply: FastifyReply,
  sellerId: string,
  dateRaw: string | undefined,
): Promise<
  | {
      date: string;
      points: { lat: number; lng: number; recordedAt: string }[];
      trailPolyline: { lat: number; lng: number }[];
      trailSource: "google_routes" | "gps_line";
      simplified: boolean;
      distanceMeters: number;
      roadDistanceMeters: number | null;
      roadRoutingConfigured: boolean;
    }
  | undefined
> {
  if (!(await assertSellerInScope(reply, auth, sellerId))) return undefined;

  const dayStart = parseVisitDay(dateRaw) ?? parseVisitDay(new Date().toISOString().slice(0, 10));
  if (!dayStart) {
    void reply.status(400).send({ error: "Data inválida (use YYYY-MM-DD)" });
    return undefined;
  }
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const rows = await prisma.sellerLocationHistory.findMany({
    where: {
      sellerId,
      organizationId: auth.organizationId,
      recordedAt: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { recordedAt: "asc" },
    select: { latitude: true, longitude: true, recordedAt: true },
  });

  let points = rows.map((r) => ({
    lat: decToNum(r.latitude),
    lng: decToNum(r.longitude),
    recordedAt: r.recordedAt.toISOString(),
  }));

  let simplified = false;
  if (points.length > MAX_POINTS) {
    simplified = true;
    const step = Math.ceil(points.length / MAX_POINTS);
    points = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  }

  let distanceMeters = 0;
  for (let i = 1; i < points.length; i++) {
    distanceMeters += haversineMeters(
      points[i - 1]!.lat,
      points[i - 1]!.lng,
      points[i]!.lat,
      points[i]!.lng,
    );
  }

  const trail = await buildTrailRoadPolyline(points);

  return {
    date: dayStart.toISOString().slice(0, 10),
    points,
    trailPolyline: trail.trailPolyline.map((p) => ({ lat: p.latitude, lng: p.longitude })),
    trailSource: trail.trailSource,
    simplified,
    distanceMeters: Math.round(distanceMeters),
    roadDistanceMeters: trail.roadDistanceMeters,
    roadRoutingConfigured: isGoogleRoutesConfigured(),
  };
}
