import { z } from "zod";
import {
  deletePushDevice,
  getWebPushPublicKey,
  upsertPushDevice,
} from "./notify.js";

export const registerPushDeviceBody = z.discriminatedUnion("platform", [
  z.object({
    platform: z.enum(["IOS", "ANDROID"]),
    expoPushToken: z.string().min(8),
  }),
  z.object({
    platform: z.literal("WEB"),
    webPushSubscription: z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      }),
    }),
  }),
]);

export const unregisterPushDeviceBody = z
  .object({
    id: z.string().optional(),
    expoPushToken: z.string().optional(),
    webPushEndpoint: z.string().optional(),
  })
  .refine(
    (b) => Boolean(b.id || b.expoPushToken || b.webPushEndpoint),
    { message: "Informe id, expoPushToken ou webPushEndpoint" },
  );

export async function handleRegisterPushDevice(
  userId: string,
  raw: unknown,
): Promise<{ id: string } | { error: string; status: number }> {
  const body = registerPushDeviceBody.safeParse(raw);
  if (!body.success) return { error: "Dados inválidos", status: 400 };

  if (body.data.platform === "WEB") {
    if (!getWebPushPublicKey()) {
      return {
        error: "Web Push não configurado no servidor (VAPID)",
        status: 503,
      };
    }
    const row = await upsertPushDevice({
      userId,
      platform: "WEB",
      webPushSubscription: body.data.webPushSubscription,
    });
    return row;
  }

  const row = await upsertPushDevice({
    userId,
    platform: body.data.platform,
    expoPushToken: body.data.expoPushToken,
  });
  return row;
}

export async function handleUnregisterPushDevice(
  userId: string,
  raw: unknown,
): Promise<{ ok: true } | { error: string; status: number }> {
  const body = unregisterPushDeviceBody.safeParse(raw);
  if (!body.success) return { error: "Dados inválidos", status: 400 };
  await deletePushDevice({ userId, ...body.data });
  return { ok: true };
}
