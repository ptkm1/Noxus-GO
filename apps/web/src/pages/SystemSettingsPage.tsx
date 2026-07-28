import { FormField, FormGrid, FormSection } from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canRead,
  getPlanDefinition,
  planHasFeature,
} from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, History, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { AuditLogsPanel } from "./AuditLogsPage";
import { OrderSituationsPanel } from "./OrderSituationsPanel";
import { PermissionsPanel } from "./PermissionsPage";

function plansUrl(): string {
  const base =
    import.meta.env.VITE_SITE_URL?.trim() || "http://localhost:3001";
  return `${base.replace(/\/$/, "")}/#planos`;
}

function formatLimit(n: number | null): string {
  return n == null ? "Ilimitado" : String(n);
}

const STATUS_LABELS: Record<string, string> = {
  TRIAL: "Trial",
  ACTIVE: "Ativo",
  PAST_DUE: "Em atraso",
  CANCELED: "Cancelado",
  INCOMPLETE: "Incompleto",
};

type OrderSyncMode = "AUTO" | "MANUAL";
type CustomerRegistrationMode = "AUTO" | "REQUIRE_APPROVAL";

type SystemSettings = {
  orderSyncMode: OrderSyncMode;
  sellerShowUnassignedCustomers: boolean;
  customerRegistrationMode: CustomerRegistrationMode;
  sellerCanEditQueuedSales: boolean;
};

type SettingsModal = "permissions" | "audit" | null;

export function SystemSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<SettingsModal>(null);

  const isAdmin = user?.role === "ADMIN";
  const canPermissions = Boolean(
    user && canRead(user.role, "permissions", user.permissions),
  );
  const canAuditRbac = Boolean(
    user && canRead(user.role, "audit", user.permissions),
  );
  const hasAuditPlan =
    user?.subscription?.features?.includes("audit") ??
    planHasFeature(user?.subscription?.planId, "audit");
  const canAudit = canAuditRbac && hasAuditPlan;
  const canAccess = isAdmin || canPermissions || canAuditRbac;

  const planDef = getPlanDefinition(user?.subscription?.planId);
  const sub = user?.subscription;
  const periodEnd = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")
    : null;
  const statusLabel =
    STATUS_LABELS[sub?.status ?? ""] ?? sub?.status ?? "—";
  const limits = sub?.limits ?? planDef.limits;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "system-settings"],
    queryFn: () => apiFetch<SystemSettings>("/admin/system-settings"),
    enabled: isAdmin,
  });

  const patch = useMutation({
    mutationFn: (body: Partial<SystemSettings>) =>
      apiFetch<SystemSettings>("/admin/system-settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "system-settings"] });
    },
  });

  useEffect(() => {
    const abrir = searchParams.get("abrir");
    if (abrir === "permissoes" && canPermissions) setModal("permissions");
    else if (abrir === "auditoria" && canAudit) setModal("audit");
  }, [searchParams, canPermissions, canAudit]);

  function closeModal() {
    setModal(null);
    if (searchParams.has("abrir")) {
      const next = new URLSearchParams(searchParams);
      next.delete("abrir");
      setSearchParams(next, { replace: true });
    }
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Regras do sistema e ferramentas administrativas.
        </p>
      </div>

      <FormSection
        title="Plano atual"
        description="Assinatura da organização e limites do plano."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-foreground">
                {planDef.name}
              </span>
              <Badge variant="secondary">{statusLabel}</Badge>
            </div>
            {periodEnd ? (
              <p className="text-muted-foreground">
                Período até {periodEnd}
                {sub?.cancelAtPeriodEnd
                  ? " · cancela ao fim do período"
                  : null}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              Limites: até {formatLimit(limits.maxSellers)} vendedores · até{" "}
              {formatLimit(limits.maxUsers)} usuários
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <a href={plansUrl()} target="_blank" rel="noreferrer">
              Ver planos / upgrade
            </a>
          </Button>
        </div>
      </FormSection>

      {isAdmin ? (
        <>
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
                  disabled={
                    isLoading || patch.isPending || settings === undefined
                  }
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
                  disabled={
                    isLoading || patch.isPending || settings === undefined
                  }
                  onCheckedChange={(v) =>
                    patch.mutate({
                      sellerCanEditQueuedSales: v === true,
                    })
                  }
                />
                <span>
                  <span className="font-medium">
                    Permitir que o vendedor edite suas vendas antes de
                    sincronizar
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Aplica-se apenas à fila offline/manual, antes da
                    sincronização. Depois que o pedido for enviado com sucesso,
                    o vendedor não poderá mais editá-lo.
                  </span>
                </span>
              </label>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Clientes no app do vendedor"
            description="Controla se a “carteira” sem vendedor (clientes sem dono) aparece na lista, na rota e nas vendas."
          >
            <label className="flex max-w-xl cursor-pointer items-start gap-3 text-sm text-foreground">
              <Checkbox
                className="mt-0.5"
                checked={settings?.sellerShowUnassignedCustomers ?? true}
                disabled={
                  isLoading || patch.isPending || settings === undefined
                }
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
                  Desligado: o vendedor só vê clientes atribuídos a ele. O
                  filtro “Só meus clientes” na rota deixa de ter efeito sobre a
                  carteira livre.
                </span>
              </span>
            </label>
          </FormSection>

          <FormSection
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
            title="Situações do pedido"
            description="Cadastre as situações operacionais usadas na lista e no detalhe do pedido."
          >
            <OrderSituationsPanel />
          </FormSection>
        </>
      ) : null}

      {patch.isError ? (
        <p className="text-sm text-destructive">
          {(patch.error as Error).message || "Não foi possível salvar."}
        </p>
      ) : null}

      {(canPermissions || canAudit) && (
        <FormSection
          title="Administração"
          description="Abra cada área em um painel, sem sair desta tela."
        >
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {canPermissions ? (
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
                onClick={() => setModal("permissions")}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Shield className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">
                    Permissões
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Matriz de leitura e escrita por role
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ) : null}
            {canAudit ? (
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
                onClick={() => setModal("audit")}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <History className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">
                    Auditoria
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Histórico de alterações no painel e no app
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ) : null}
          </div>
        </FormSection>
      )}

      <Dialog
        open={modal === "permissions"}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Permissões</DialogTitle>
            <DialogDescription>
              Ajuste o acesso de cada role na organização.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {modal === "permissions" ? <PermissionsPanel embedded /> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modal === "audit"}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Auditoria</DialogTitle>
            <DialogDescription>
              Consulte o histórico de ações na organização.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {modal === "audit" ? <AuditLogsPanel embedded /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
