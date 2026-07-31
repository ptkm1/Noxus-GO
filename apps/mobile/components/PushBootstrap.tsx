import { useAuth } from "@/context/AuthContext";
import { useAppToast } from "@/context/ToastContext";
import {
  clearLocalPushRegistration,
  hrefFromNotificationData,
  registerForPushNotifications,
  unregisterCurrentPushDevice,
} from "@/lib/push";
import {
  isPushNotificationsEnabled,
  subscribePrivacyPreferences,
} from "@/lib/privacy-preferences";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/**
 * Regista Expo Push Token após login e trata taps / foreground.
 * O unregister no servidor fica no logout (antes de limpar tokens).
 */
export function PushBootstrap() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useAppToast();
  const tokenRef = useRef<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void isPushNotificationsEnabled().then((enabled) => {
        if (mounted) setPushEnabled(enabled);
      });
    };

    refresh();
    const unsub = subscribePrivacyPreferences(refresh);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!user || !pushEnabled) {
      if (user && !pushEnabled) void unregisterCurrentPushDevice();
      tokenRef.current = null;
      clearLocalPushRegistration();
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const token = await registerForPushNotifications();
        if (!cancelled) {
          tokenRef.current = token;
          if (__DEV__ && token) {
            console.log(`[push] Expo token registado: ${token.slice(0, 28)}…`);
          } else if (__DEV__ && !token) {
            console.warn(
              "[push] Sem token (permissão negada, simulador ou falha FCM/EAS).",
            );
          }
        }
      } catch (e) {
        console.warn("[push] register failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, user?.id, pushEnabled]);

  useEffect(() => {
    const subReceive = Notifications.addNotificationReceivedListener((n) => {
      if (AppState.currentState !== "active") return;
      const title = n.request.content.title ?? "Notificação";
      const body = n.request.content.body ?? "";
      showToast({
        message: body ? `${title}: ${body}` : title,
        tone: "success",
        durationMs: 4000,
      });
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const href = hrefFromNotificationData(data);
        if (href) router.push(href as never);
      },
    );

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const href = hrefFromNotificationData(data);
      if (href) router.push(href as never);
    });

    return () => {
      subReceive.remove();
      subResponse.remove();
    };
  }, [router, showToast]);

  return null;
}
