import { EstablishmentsSettingsPanel } from "@/components/EstablishmentsSettingsPanel";
import { SettingsDetailShell } from "@/components/settings/SettingsDetailShell";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function EstablishmentsSettingsPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/configuracoes" replace />;

  return (
    <SettingsDetailShell
      title="Estabelecimentos"
      description="CNPJs da conta (estoque compartilhado, fiscal por CNPJ)."
    >
      <EstablishmentsSettingsPanel />
    </SettingsDetailShell>
  );
}
