import { FormField, FormGrid, FormSection } from "@/components/forms";
import { SettingsDetailShell } from "@/components/settings/SettingsDetailShell";
import { AppSelect } from "@/components/ui/app-select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useAdminSystemSettings,
  type CustomerRegistrationMode,
} from "@/hooks/useAdminSystemSettings";
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function CustomerSettingsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === "ADMIN";
  const { settings, isLoading, patch } = useAdminSystemSettings(Boolean(isAdmin));

  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, settings]);

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/configuracoes" replace />;

  return (
    <SettingsDetailShell
      title="Clientes"
      description="Carteira no app, aprovação de cadastro e inativação automática."
    >
      <div className="space-y-4">
        <FormSection
          id="carteira"
          className="scroll-mt-6"
          title="Clientes no app do vendedor"
          description="Controla se a “carteira” sem vendedor (clientes sem dono) aparece na lista, na rota e nas vendas."
        >
          <label className="flex max-w-xl cursor-pointer items-start gap-3 text-sm text-foreground">
            <Checkbox
              className="mt-0.5"
              checked={settings?.sellerShowUnassignedCustomers ?? true}
              disabled={isLoading || patch.isPending || settings === undefined}
              onCheckedChange={(v) =>
                patch.mutate({
                  sellerShowUnassignedCustomers: v === true,
                })
              }
            />
            <span>
              <span className="font-medium">
                Mostrar clientes sem vendedor atribuído
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                Desligado: o vendedor só vê clientes atribuídos a ele. O filtro
                “Só meus clientes” na rota deixa de ter efeito sobre a carteira
                livre.
              </span>
            </span>
          </label>
        </FormSection>

        <FormSection
          id="cadastro"
          className="scroll-mt-6"
          title="Cadastro de clientes pelo vendedor"
          description="Define se o cliente criado no app já pode ser usado nas vendas ou se precisa de validação no escritório."
        >
          <FormGrid cols={2}>
            <FormField
              label="Modo de cadastro"
              htmlFor="customer-registration-mode"
              className="sm:col-span-2 max-w-xl"
              hint={
                (settings?.customerRegistrationMode ?? "AUTO") ===
                "REQUIRE_APPROVAL"
                  ? "Com validação: o cadastro fica pendente até um admin ou gestor com permissão aprovar na tela de Clientes."
                  : "Automático: o vendedor cadastra e o cliente já fica disponível para venda e rota."
              }
            >
              <AppSelect
                id="customer-registration-mode"
                value={settings?.customerRegistrationMode ?? "AUTO"}
                disabled={
                  isLoading || patch.isPending || settings === undefined
                }
                options={[
                  {
                    value: "AUTO",
                    label: "Automático (liberado na hora)",
                  },
                  {
                    value: "REQUIRE_APPROVAL",
                    label: "Aguardar validação do escritório",
                  },
                ]}
                onValueChange={(v) =>
                  patch.mutate({
                    customerRegistrationMode: v as CustomerRegistrationMode,
                  })
                }
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection
          id="inativacao"
          className="scroll-mt-6"
          title="Inativação automática de clientes"
          description="Marca como inativo o cliente sem pedido confirmado há 6 meses. Ao comprar de novo, o status volta para ativo."
        >
          <label className="flex max-w-xl cursor-pointer items-start gap-3 text-sm text-foreground">
            <Checkbox
              className="mt-0.5"
              checked={settings?.autoInactivateCustomersAfterMonths ?? false}
              disabled={isLoading || patch.isPending || settings === undefined}
              onCheckedChange={(v) =>
                patch.mutate({
                  autoInactivateCustomersAfterMonths: v === true,
                })
              }
            />
            <span>
              <span className="font-medium">
                Inativar clientes sem movimento há 6 meses
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                Desligado por padrão. Quando ligado, a situação comercial do
                cliente passa a Inativo sem compra confirmada no período; uma
                nova venda confirmada reativa automaticamente.
              </span>
            </span>
          </label>
        </FormSection>
      </div>
      {patch.isError ? (
        <p className="text-sm text-destructive">
          {(patch.error as Error).message || "Não foi possível salvar."}
        </p>
      ) : null}
    </SettingsDetailShell>
  );
}
