import { apiBase } from "../../lib/api";
import { useConfirm } from "../../context/ConfirmContext";
import {
  getPrivacyPreferences,
  PRIVACY_LINKS,
  setLocationTrackingEnabled,
  setPushNotificationsEnabled,
  subscribePrivacyPreferences,
} from "../../lib/privacy-preferences";
import { useLogout } from "../useLogout";
import { useCallback, useEffect, useState } from "react";

export function useSettingsScreen() {
  const { logoutAndGoLogin, logoutPending } = useLogout();
  const { confirm } = useConfirm();
  const [locationTrackingEnabled, setLocationTrackingState] = useState(false);
  const [pushNotificationsEnabled, setPushState] = useState(false);

  const refreshPrivacyPreferences = useCallback(async () => {
    const prefs = await getPrivacyPreferences();
    setLocationTrackingState(prefs.locationTrackingEnabled);
    setPushState(prefs.pushNotificationsEnabled);
  }, []);

  useEffect(() => {
    void refreshPrivacyPreferences();
    return subscribePrivacyPreferences(() => {
      void refreshPrivacyPreferences();
    });
  }, [refreshPrivacyPreferences]);

  const setLocationTracking = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const accepted = await confirm({
          title: "Ativar rastreamento de rota?",
          description:
            "O PedixPro enviará sua localização precisa para a gestão da sua organização durante rotas e visitas de trabalho. Quando ativo, o envio pode continuar em segundo plano até você desativar esta opção.",
          confirmLabel: "Ativar",
          cancelLabel: "Cancelar",
        });
        if (!accepted) return;
      }
      setLocationTrackingState(enabled);
      await setLocationTrackingEnabled(enabled);
    },
    [confirm],
  );

  const setPushNotifications = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const accepted = await confirm({
          title: "Ativar notificações?",
          description:
            "O PedixPro enviará alertas operacionais sobre pedidos, aprovações, estoque, cobrança e comissões. Você pode desativar esta opção depois.",
          confirmLabel: "Ativar",
          cancelLabel: "Cancelar",
        });
        if (!accepted) return;
      }
      setPushState(enabled);
      await setPushNotificationsEnabled(enabled);
    },
    [confirm],
  );

  return {
    apiUrl: apiBase(),
    locationTrackingEnabled,
    pushNotificationsEnabled,
    privacyLinks: PRIVACY_LINKS,
    setLocationTracking,
    setPushNotifications,
    logoutAndGoLogin,
    logoutPending,
  };
}
