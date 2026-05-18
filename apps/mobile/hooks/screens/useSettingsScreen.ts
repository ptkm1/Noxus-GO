import { useRouter } from "expo-router";
import { useCallback } from "react";
import { apiBase } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export function useSettingsScreen() {
  const { logout } = useAuth();
  const router = useRouter();

  const logoutAndGoLogin = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [logout, router]);

  return {
    apiUrl: apiBase(),
    logoutAndGoLogin,
  };
}
