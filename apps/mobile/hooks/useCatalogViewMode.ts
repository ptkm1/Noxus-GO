import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type CatalogViewMode = "grid" | "list";

/** v3: default cards horizontais (list). */
const STORAGE_KEY = "pedidos_catalog_view_mode_v3";
const DEFAULT_MODE: CatalogViewMode = "list";

export function useCatalogViewMode() {
  const [viewMode, setViewModeState] = useState<CatalogViewMode>(DEFAULT_MODE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      if (raw === "grid" || raw === "list") setViewModeState(raw);
      else setViewModeState(DEFAULT_MODE);
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
