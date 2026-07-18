import { apiFetch } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function webPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  const res = await apiFetch<{ publicKey: string | null }>(
    "/admin/push-vapid-public-key",
  );
  return res.publicKey;
}

export async function subscribeWebPush(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (!webPushSupported()) {
    return { ok: false, reason: "Este navegador não suporta Web Push." };
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    return {
      ok: false,
      reason: "Web Push não configurado no servidor (VAPID).",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Permissão de notificação negada." };
  }

  const reg = await navigator.serviceWorker.register("/push-sw.js", {
    scope: "/",
  });
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "Subscription inválida." };
  }

  await apiFetch("/admin/push-devices", {
    method: "POST",
    body: JSON.stringify({
      platform: "WEB",
      webPushSubscription: {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      },
    }),
  });

  return { ok: true };
}

export async function getWebPushStatus(): Promise<
  "unsupported" | "unconfigured" | "denied" | "subscribed" | "ready"
> {
  if (!webPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const key = await fetchVapidPublicKey();
    if (!key) return "unconfigured";
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) return "subscribed";
    return "ready";
  } catch {
    return "ready";
  }
}
