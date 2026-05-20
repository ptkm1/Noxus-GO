import { prisma } from "../db.js";
import { decToNum } from "../util/money.js";
import { isSellerLocationOnline, SELLER_ONLINE_MAX_AGE_MS } from "./seller-live-location.js";

export type AdminSellerLocationRow = {
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  active: boolean;
  isOnline: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  recordedAt: string | null;
  activeVisit: {
    id: string;
    customerId: string;
    customerName: string;
    checkedInAt: string;
  } | null;
};

export async function listAdminSellerLocations(organizationId: string): Promise<{
  onlineThresholdMinutes: number;
  sellers: AdminSellerLocationRow[];
}> {
  const now = new Date();

  const [sellers, openVisits] = await Promise.all([
    prisma.seller.findMany({
      where: { organizationId, active: true },
      include: {
        user: { select: { name: true, email: true } },
        liveLocation: true,
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.sellerCustomerVisit.findMany({
      where: { organizationId, checkedOutAt: null },
      include: { customer: { select: { id: true, name: true } } },
    }),
  ]);

  const visitBySeller = new Map(openVisits.map((v) => [v.sellerId, v]));

  const rows: AdminSellerLocationRow[] = sellers.map((s) => {
    const loc = s.liveLocation;
    const recordedAt = loc?.recordedAt ?? null;
    const visit = visitBySeller.get(s.id);

    return {
      sellerId: s.id,
      sellerName: s.user.name,
      sellerEmail: s.user.email,
      active: s.active,
      isOnline: recordedAt != null && isSellerLocationOnline(recordedAt, now),
      latitude: loc ? decToNum(loc.latitude) : null,
      longitude: loc ? decToNum(loc.longitude) : null,
      accuracyMeters: loc?.accuracyMeters ?? null,
      recordedAt: recordedAt?.toISOString() ?? null,
      activeVisit: visit
        ? {
            id: visit.id,
            customerId: visit.customerId,
            customerName: visit.customer.name,
            checkedInAt: visit.checkedInAt.toISOString(),
          }
        : null,
    };
  });

  return {
    onlineThresholdMinutes: Math.round(SELLER_ONLINE_MAX_AGE_MS / 60_000),
    sellers: rows,
  };
}
