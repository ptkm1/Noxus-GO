import { FormField, FormGrid, FormSection } from "@/components/forms";
import { SettingsDetailShell } from "@/components/settings/SettingsDetailShell";
import { AppSelect } from "@/components/ui/app-select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useAdminSystemSettings,
  type OrderSyncMode,
} from "@/hooks/useAdminSystemSettings";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function OrderSyncSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { settings, isLoading, patch } = useAdminSystemSettings(Boolean(isAdmin));

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/configuracoes" replace />;

  return (
    <SettingsDetailShell
      title="Sincronização de pedidos"
      description="Define se o app envia pedidos sozinho ou se o vendedor precisa tocar em “Sincronizar”."
    >
      <FormSection
        title="Envio e fila"
        description="Modo de sincronização e edição de vendas antes do envio."
      >
        <FormGrid cols={2}>
          <FormField
            label="Modo de envio"
            htmlFor="order-sync-mode"
            className="sm:col-span-2 max-w-xl"
            hint={
              (settings?.orderSyncMode ?? "AUTO") === "MANUAL"
                ? "Manual: cada pedido fica na fila local até o vendedor sincronizar — mesmo com internet."
                : "Automático: tenta enviar na hora; se falhar, enfileira e reenvia sozinho quando houver rede."
            }
          >
            <AppSelect
              id="order-sync-mode"
              value={settings?.orderSyncMode ?? "AUTO"}
              disabled={isLoading || patch.isPending || settings === undefined}
              options={[
                {
                  value: "AUTO",
                  label: "Automático (comportamento atual)",
                },
                {
                  value: "MANUAL",
                  label: "Manual (vendedor sincroniza na fila)",
                },
              ]}
              onValueChange={(v) =>
                patch.mutate({ orderSyncMode: v as OrderSyncMode })
              }
            />
          </FormField>
          <label className="flex max-w-xl cursor-pointer items-start gap-3 text-sm text-foreground sm:col-span-2">
            <Checkbox
              className="mt-0.5"
              checked={settings?.sellerCanEditQueuedSales ?? false}
              disabled={isLoading || patch.isPending || settings === undefined}
              onCheckedChange={(v) =>
                patch.mutate({
                  sellerCanEditQueuedSales: v === true,
                })
              }
            />
            <span>
              <span className="font-medium">
                Permitir que o vendedor edite suas vendas antes de sincronizar
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                Aplica-se apenas à fila offline/manual, antes da sincronização.
                Depois que o pedido for enviado com sucesso, o vendedor não
                poderá mais editá-lo.
              </span>
            </span>
          </label>
        </FormGrid>
      </FormSection>
      {patch.isError ? (
        <p className="text-sm text-destructive">
          {(patch.error as Error).message || "Não foi possível salvar."}
        </p>
      ) : null}
    </SettingsDetailShell>
  );
}
