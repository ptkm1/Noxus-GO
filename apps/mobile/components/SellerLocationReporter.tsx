import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "../context/AuthContext";
import { pingSellerLocationIfNeeded } from "../lib/seller-location-ping";

/**
 * Envia GPS do vendedor enquanto o app está em primeiro plano (rastreio no painel admin).
 * Intervalo ~40s ou após deslocamento relevante.
 */
export function SellerLocationReporter() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (Platform.OS === "web" || loading || !user) return;

    const run = () => {
      void pingSellerLocationIfNeeded().catch(() => {
        /* rede/GPS — ignora silenciosamente */
      });
    };

    run();

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") run();
    });

    const interval = setInterval(run, 45_000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [user, loading]);

  return null;
}
