import { apiBase } from "../../lib/api";
import { useLogout } from "../useLogout";

export function useSettingsScreen() {
  const { logoutAndGoLogin, logoutPending } = useLogout();

  return {
    apiUrl: apiBase(),
    logoutAndGoLogin,
    logoutPending,
  };
}
