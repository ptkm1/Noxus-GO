import { FormField, FormGrid, FormSection } from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";

type OrderSyncMode = "AUTO" | "MANUAL";

type SystemSettings = {
  orderSyncMode: OrderSyncMode;
};

export function SystemSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "system-settings"],
    queryFn: () => apiFetch<SystemSettings>("/admin/system-settings"),
    enabled: user?.role === "ADMIN",
  });

  const patch = useMutation({
    mutationFn: (orderSyncMode: OrderSyncMode) =>
      apiFetch<SystemSettings>("/admin/system-settings", {
        method: "PATCH",
        body: JSON.stringify({ orderSyncMode }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "system-settings"] });
    },
  });

  if (user?.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Regras do sistema que afetam o app do vendedor. Comece pela
          sincronização de pedidos; outras políticas poderão entrar aqui depois.
        </p>
      </div>

      <FormSection
        title="Sincronização de pedidos"
        description="Define se o app envia pedidos sozinho ou se o vendedor precisa tocar em “Sincronizar”."
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
              onValueChange={(v) => patch.mutate(v as OrderSyncMode)}
            />
          </FormField>
        </FormGrid>
        {patch.isError ? (
          <p className="mt-2 text-sm text-destructive">
            {(patch.error as Error).message || "Não foi possível salvar."}
          </p>
        ) : null}
      </FormSection>
    </div>
  );
}
