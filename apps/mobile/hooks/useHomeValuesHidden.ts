import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pedixpro_home_values_hidden";

/** Preferência da home: ocultar totais/comissões/indicadores monetários. */
export function useHomeValuesHidden() {
  const [hidden, setHiddenState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      setHiddenState(raw === "true");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setHidden = useCallback((value: boolean) => {
    setHiddenState(value);
    void AsyncStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  }, []);

  const toggleHidden = useCallback(() => {
    setHiddenState((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(STORAGE_KEY, next ? "true" : "false");
      return next;
    });
  }, []);

  return { hidden, setHidden, toggleHidden };
}
