import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "../context/AuthContext";
import { prefetchSellerReadCache } from "../lib/seller-offline-queries";

function isOnlineState(s: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean {
  return Boolean(s.isConnected) && s.isInternetReachable !== false;
}

/** Pré-carrega catálogo/clientes/vendas/comissão para SQLite quando online. */
export function SellerCacheBootstrap() {
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const running = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web" || loading || !user || user.role !== "SELLER") {
      return;
    }

    const run = () => {
      if (running.current) return;
      running.current = true;
      void prefetchSellerReadCache(qc)
        .catch((e) => {
          if (__DEV__) {
            console.warn("[SellerCacheBootstrap]", e);
          }
        })
        .finally(() => {
          running.current = false;
        });
    };

    void NetInfo.fetch().then((s) => {
      if (isOnlineState(s)) run();
    });

    const unsubNet = NetInfo.addEventListener((s) => {
      if (isOnlineState(s)) run();
    });

    const subApp = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      void NetInfo.fetch().then((s) => {
        if (isOnlineState(s)) run();
      });
    });

    return () => {
      unsubNet();
      subApp.remove();
    };
  }, [qc, user, loading]);

  return null;
}
