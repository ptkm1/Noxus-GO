import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "../context/AuthContext";
import {
  isBackgroundLocationNativeAvailable,
  startSellerBackgroundLocation,
  stopSellerBackgroundLocation,
} from "../lib/seller-location-background";
import { pingSellerLocationIfNeeded } from "../lib/seller-location-ping";

/**
 * Envia GPS do vendedor (foreground + background com permissão) para o painel admin.
 */
export function SellerLocationReporter() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (Platform.OS === "web" || loading || !user) {
      void stopSellerBackgroundLocation();
      return;
    }

    const run = () => {
      if (AppState.currentState !== "active") return;
      void pingSellerLocationIfNeeded().catch(() => {
        /* rede/GPS — ignora silenciosamente */
      });
    };

    run();
    if (isBackgroundLocationNativeAvailable()) {
      void startSellerBackgroundLocation().catch(() => {
        /* permissão negada — foreground continua */
      });
    }

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") run();
    });

    const interval = setInterval(run, 45_000);

    return () => {
      sub.remove();
      clearInterval(interval);
      void stopSellerBackgroundLocation();
    };
  }, [user, loading]);

  return null;
}
