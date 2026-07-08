import { apiBase } from "../../lib/api";
import { useLogout } from "../useLogout";

export function useSettingsScreen() {
  const logoutAndGoLogin = useLogout();

  return {
    apiUrl: apiBase(),
    logoutAndGoLogin,
  };
}
