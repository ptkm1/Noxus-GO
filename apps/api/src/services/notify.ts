import type { NotificationType } from "@pedidos/shared";
import type { Prisma, PushPlatform } from "@prisma/client";
import webpush from "web-push";
import { prisma } from "../db.js";

export type NotifyData = {
  orderId?: string;
  sellerId?: string;
  goalId?: string;
  href?: string;
  [key: string]: unknown;
};

export type NotifyUsersParams = {
  userIds: string[];
  title: string;
  body: string;
  type: NotificationType | string;
  data?: NotifyData;
};

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoPushResponse = {
  data: ExpoPushTicket[];
};

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => id.length > 0))];
}

function readWebPushConfig(): {
  publicKey: string;
  privateKey: string;
  subject: string;
} | null {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const subject =
    process.env.WEB_PUSH_SUBJECT?.trim() ||
    process.env.WEB_APP_ORIGIN?.trim() ||
    "mailto:noreply@localhost";
  return { publicKey, privateKey, subject };
}

export function getWebPushPublicKey(): string | null {
  return readWebPushConfig()?.publicKey ?? null;
}

async function sendExpoPush(params: {
  tokens: string[];
  title: string;
  body: string;
  data?: NotifyData;
}): Promise<string[]> {
  if (!params.tokens.length) return [];

  const messages = params.tokens.map((to) => ({
    to,
    sound: "default" as const,
    title: params.title,
    body: params.body,
    data: params.data ?? {},
  }));

  const invalid: string[] = [];
  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.warn("[push] Expo HTTP", res.status, await res.text());
        continue;
      }
      const json = (await res.json()) as ExpoPushResponse;
      json.data?.forEach((ticket, idx) => {
        if (ticket.status === "error") {
          const err = ticket.details?.error;
          if (err === "DeviceNotRegistered" || err === "InvalidCredentials") {
            invalid.push(chunk[idx]!.to);
          } else {
            console.warn("[push] Expo ticket error:", ticket.message, err);
          }
        }
      });
    } catch (e) {
      console.warn("[push] Expo send failed:", e);
    }
  }
  return invalid;
}

async function sendWebPush(params: {
  devices: Array<{ id: string; subscription: unknown }>;
  title: string;
  body: string;
  data?: NotifyData;
}): Promise<string[]> {
  const cfg = readWebPushConfig();
  if (!cfg || !params.devices.length) return [];

  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

  const payload = JSON.stringify({
    title: params.title,
    body: params.body,
    data: params.data ?? {},
  });

  const deadIds: string[] = [];
  await Promise.all(
    params.devices.map(async (d) => {
      try {
        const sub = d.subscription as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        };
        await webpush.sendNotification(sub, payload);
      } catch (e: unknown) {
        const status =
          e && typeof e === "object" && "statusCode" in e
            ? Number((e as { statusCode: number }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          deadIds.push(d.id);
        } else {
          console.warn("[push] Web Push failed:", e);
        }
      }
    }),
  );
  return deadIds;
}

/**
 * Grava inbox in-app e faz fan-out Expo + Web Push.
 * Nunca lança por falha de push — a inbox é a fonte da verdade.
 */
export async function notifyUsers(params: NotifyUsersParams): Promise<void> {
  const userIds = uniqueIds(params.userIds);
  if (!userIds.length) return;

  const data = params.data ?? null;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: params.title,
      body: params.body,
      type: params.type,
      data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
    })),
  });

  try {
    const devices = await prisma.pushDevice.findMany({
      where: { userId: { in: userIds } },
    });

    const expoTokens = devices
      .map((d) => d.expoPushToken)
      .filter((t): t is string => typeof t === "string" && t.length > 0);

    const webDevices = devices
      .filter((d) => d.platform === "WEB" && d.webPushSubscription != null)
      .map((d) => ({ id: d.id, subscription: d.webPushSubscription }));

    const [invalidTokens, deadWebIds] = await Promise.all([
      sendExpoPush({
        tokens: expoTokens,
        title: params.title,
        body: params.body,
        data: params.data,
      }),
      sendWebPush({
        devices: webDevices,
        title: params.title,
        body: params.body,
        data: params.data,
      }),
    ]);

    if (invalidTokens.length) {
      await prisma.pushDevice.deleteMany({
        where: { expoPushToken: { in: invalidTokens } },
      });
    }
    if (deadWebIds.length) {
      await prisma.pushDevice.deleteMany({
        where: { id: { in: deadWebIds } },
      });
    }
  } catch (e) {
    console.warn("[push] Fan-out failed after inbox write:", e);
  }
}

export type UpsertPushDeviceInput =
  | {
      userId: string;
      platform: "IOS" | "ANDROID";
      expoPushToken: string;
    }
  | {
      userId: string;
      platform: "WEB";
      webPushSubscription: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
    };

export async function upsertPushDevice(
  input: UpsertPushDeviceInput,
): Promise<{ id: string }> {
  if (input.platform === "WEB") {
    const endpoint = input.webPushSubscription.endpoint;
    const row = await prisma.pushDevice.upsert({
      where: { webPushEndpoint: endpoint },
      create: {
        userId: input.userId,
        platform: "WEB" satisfies PushPlatform,
        webPushEndpoint: endpoint,
        webPushSubscription: input.webPushSubscription as Prisma.InputJsonValue,
      },
      update: {
        userId: input.userId,
        platform: "WEB",
        webPushSubscription: input.webPushSubscription as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return row;
  }

  const row = await prisma.pushDevice.upsert({
    where: { expoPushToken: input.expoPushToken },
    create: {
      userId: input.userId,
      platform: input.platform,
      expoPushToken: input.expoPushToken,
    },
    update: {
      userId: input.userId,
      platform: input.platform,
    },
    select: { id: true },
  });
  return row;
}

export async function deletePushDevice(params: {
  userId: string;
  expoPushToken?: string;
  webPushEndpoint?: string;
  id?: string;
}): Promise<number> {
  if (params.id) {
    const result = await prisma.pushDevice.deleteMany({
      where: { id: params.id, userId: params.userId },
    });
    return result.count;
  }
  if (params.expoPushToken) {
    const result = await prisma.pushDevice.deleteMany({
      where: { expoPushToken: params.expoPushToken, userId: params.userId },
    });
    return result.count;
  }
  if (params.webPushEndpoint) {
    const result = await prisma.pushDevice.deleteMany({
      where: {
        webPushEndpoint: params.webPushEndpoint,
        userId: params.userId,
      },
    });
    return result.count;
  }
  return 0;
}
