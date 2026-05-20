import type { WebSocket } from "@fastify/websocket";

export type SellerLocationWsPayload = {
  type: "seller_location";
  sellerId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  recordedAt: string;
  managerUserId: string | null;
};

type ClientMeta = {
  socket: WebSocket;
  role: "ADMIN" | "MANAGER";
  userId: string;
};

const clientsByOrg = new Map<string, Set<ClientMeta>>();

export function registerSellerLocationClient(
  organizationId: string,
  meta: ClientMeta,
): () => void {
  let set = clientsByOrg.get(organizationId);
  if (!set) {
    set = new Set();
    clientsByOrg.set(organizationId, set);
  }
  set.add(meta);

  return () => {
    set!.delete(meta);
    if (set!.size === 0) clientsByOrg.delete(organizationId);
  };
}

export function broadcastSellerLocation(
  organizationId: string,
  payload: SellerLocationWsPayload,
): void {
  const set = clientsByOrg.get(organizationId);
  if (!set?.size) return;

  const msg = JSON.stringify(payload);
  for (const client of set) {
    if (client.role === "MANAGER" && payload.managerUserId !== client.userId) {
      continue;
    }
    if (client.socket.readyState === 1) {
      client.socket.send(msg);
    }
  }
}
