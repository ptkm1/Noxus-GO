import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";

/** Limpa sessão, cache e volta à tela de login. */
export function useLogout() {
  const { logout } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  return useCallback(async () => {
    await logout();
    qc.clear();
    router.replace("/login");
  }, [logout, router, qc]);
}
