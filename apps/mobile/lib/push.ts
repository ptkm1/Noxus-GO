import { apiFetch } from "@/lib/api";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Token Expo actualmente associado à sessão (para logout limpar no servidor). */
let registeredExpoToken: string | null = null;

function projectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    (
      Constants.expoConfig?.extra as
        | { eas?: { projectId?: string } }
        | undefined
    )?.eas?.projectId
  );
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[push] Push requer device físico");
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Padrão",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const pid = projectId();
  const tokenRes = await Notifications.getExpoPushTokenAsync(
    pid ? { projectId: pid } : undefined,
  );
  const token = tokenRes.data;
  if (!token) return null;

  const platform = Platform.OS === "ios" ? "IOS" : "ANDROID";
  await apiFetch("/seller/push-devices", {
    method: "POST",
    body: JSON.stringify({ platform, expoPushToken: token }),
  });

  registeredExpoToken = token;
  return token;
}

export async function unregisterPushToken(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await apiFetch("/seller/push-devices", {
      method: "DELETE",
      body: JSON.stringify({ expoPushToken: token }),
    });
  } catch {
    /* ignore — rede / 401 */
  } finally {
    if (registeredExpoToken === token) registeredExpoToken = null;
  }
}

/**
 * Remove o device da conta actual. Chamar **antes** de clearTokens no logout,
 * enquanto o access token ainda é válido.
 */
export async function unregisterCurrentPushDevice(): Promise<void> {
  let token = registeredExpoToken;
  if (!token && Device.isDevice) {
    try {
      const pid = projectId();
      const tokenRes = await Notifications.getExpoPushTokenAsync(
        pid ? { projectId: pid } : undefined,
      );
      token = tokenRes.data ?? null;
    } catch {
      token = null;
    }
  }
  await unregisterPushToken(token);
}

export function clearLocalPushRegistration(): void {
  registeredExpoToken = null;
}

export function hrefFromNotificationData(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;
  if (typeof data.href === "string" && data.href.length > 0) {
    const href = data.href;
    if (href.startsWith("/vendas/") || href.startsWith("/pedidos/")) {
      const id = href.replace(/^\/(vendas|pedidos)\//, "");
      return `/(tabs)/vendas/${id}`;
    }
    if (href === "/commission" || href.startsWith("/commission")) {
      return "/(tabs)/commission";
    }
    if (href.startsWith("/")) return href;
  }
  if (typeof data.orderId === "string" && data.orderId.length > 0) {
    return `/(tabs)/vendas/${data.orderId}`;
  }
  return null;
}
