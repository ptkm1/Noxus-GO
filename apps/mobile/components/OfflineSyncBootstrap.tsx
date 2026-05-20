import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "../context/AuthContext";
import { flushOfflineSaleOutbox } from "../lib/offline-sale-sync";

/** Liga rede / volta ao primeiro plano / intervalo para drenar a fila SQLite de vendas. */
export function OfflineSyncBootstrap() {
  const qc = useQueryClient();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (Platform.OS === "web" || loading || !user) return;

    const run = () => {
      void flushOfflineSaleOutbox(qc).catch(() => {
        /* SQLite/rede — não poluir o LogBox no mapa ou outras telas */
      });
    };

    run();

    const unsubNet = NetInfo.addEventListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) run();
    });

    const subApp = AppState.addEventListener("change", (next) => {
      if (next === "active") run();
    });

    const interval = setInterval(run, 45_000);

    return () => {
      unsubNet();
      subApp.remove();
      clearInterval(interval);
    };
  }, [qc, user, loading]);

  return null;
}
