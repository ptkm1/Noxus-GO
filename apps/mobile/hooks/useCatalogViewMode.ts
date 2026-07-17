import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type CatalogViewMode = "grid" | "list";

const STORAGE_KEY = "pedidos_catalog_view_mode";

export function useCatalogViewMode() {
  const [viewMode, setViewModeState] = useState<CatalogViewMode>("grid");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      if (raw === "grid" || raw === "list") setViewModeState(raw);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setViewMode = useCallback((mode: CatalogViewMode) => {
    setViewModeState(mode);
    void AsyncStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewModeState((prev) => {
      const next: CatalogViewMode = prev === "grid" ? "list" : "grid";
      void AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { viewMode, setViewMode, toggleViewMode, ready };
}
