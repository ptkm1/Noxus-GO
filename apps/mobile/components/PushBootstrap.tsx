import { useAuth } from "@/context/AuthContext";
import { useAppToast } from "@/context/ToastContext";
import {
  hrefFromNotificationData,
  registerForPushNotifications,
  unregisterPushToken,
} from "@/lib/push";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Regista Expo Push Token após login e trata taps / foreground.
 */
export function PushBootstrap() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useAppToast();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      const prev = tokenRef.current;
      tokenRef.current = null;
      if (prev) void unregisterPushToken(prev);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const token = await registerForPushNotifications();
        if (!cancelled) tokenRef.current = token;
      } catch (e) {
        console.warn("[push] register failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
