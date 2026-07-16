import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext";

/** Limpa sessão, cache e volta à tela de login. */
export function useLogout() {
  const { logout } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  const logoutAndGoLogin = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await logout();
      qc.clear();
      router.replace("/login");
    } finally {
      setPending(false);
    }
  }, [logout, router, qc, pending]);

  return { logoutAndGoLogin, logoutPending: pending };
}
