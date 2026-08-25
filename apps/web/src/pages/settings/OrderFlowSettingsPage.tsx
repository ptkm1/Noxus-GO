import { SettingsDetailShell } from "@/components/settings/SettingsDetailShell";
import { OrderSituationsPanel } from "@/pages/OrderSituationsPanel";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function OrderFlowSettingsPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/configuracoes" replace />;

  return (
    <SettingsDetailShell
      title="Fluxo do pedido"
      description="Único cadastro de etapas do pedido: rascunho, crédito, operação, entrega e cancelamento."
    >
      <OrderSituationsPanel />
    </SettingsDetailShell>
  );
}
