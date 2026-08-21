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
    HOME_INDICATOR_KEYS,
    HOME_INDICATOR_LABELS,
    HOME_INDICATORS_LAYOUT_LABELS,
    HOME_INDICATORS_LAYOUTS,
    MAX_HOME_INDICATORS,
    normalizeHomeIndicators,
    normalizeHomeIndicatorsLayout,
    planHasFeature,
    listPlans,
    planSeatPriceCaption,
    type HomeIndicatorKey,
    type HomeIndicatorsLayout,
    type PlanId,
} from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ChevronDown,
    ChevronRight,
    ChevronUp,
    History,
    Shield,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { AuditLogsPanel } from "./AuditLogsPage";
import { OrderSituationsPanel } from "./OrderSituationsPanel";
import { PermissionsPanel } from "./PermissionsPage";

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
  autoInactivateCustomersAfterMonths: boolean;
  homeIndicators: HomeIndicatorKey[];
  homeIndicatorsLayout: HomeIndicatorsLayout;
};

type SettingsModal = "permissions" | "audit" | null;

type BillingReconcileUiReport = {
  dryRun: boolean;
  issues: string[];
  fixed: string[];
  before: { planId: string; providerCustomerId: string | null };
  after: { planId: string; providerCustomerId: string | null };
  duplicateCustomers: Array<{
    id: string;
    name: string | null;
    isCanonical: boolean;
  }>;
};

export function SystemSettingsPage() {
  const { user, refreshUser } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<SettingsModal>(null);
  const [checkoutPlanId, setCheckoutPlanId] = useState<PlanId>(
    (user?.subscription?.planId as PlanId) ?? "pro",
  );
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);
  const userPickedPlanRef = useRef(false);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileReport, setReconcileReport] =
    useState<BillingReconcileUiReport | null>(null);

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
  const currentPlanId = (sub?.planId as PlanId | undefined) ?? null;
  const isActiveSubscription =
    sub?.status === "ACTIVE" || sub?.status === "TRIAL";
  const isSamePlanSelected =
    currentPlanId !== null && checkoutPlanId === currentPlanId;
  const canChangePlan = !isSamePlanSelected || !isActiveSubscription;
  const periodEnd = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")
    : null;
  const statusLabel = STATUS_LABELS[sub?.status ?? ""] ?? sub?.status ?? "—";
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
      void qc.invalidateQueries({
        queryKey: ["admin", "reports", "home-dashboard-config"],
      });
    },
  });

  const selectedIndicators = normalizeHomeIndicators(settings?.homeIndicators);
  const indicatorsLayout = normalizeHomeIndicatorsLayout(
    settings?.homeIndicatorsLayout,
  );

  function toggleIndicator(key: HomeIndicatorKey) {
    const current = selectedIndicators;
    const exists = current.includes(key);
    let next: HomeIndicatorKey[];
    if (exists) {
      next = current.filter((k) => k !== key);
      if (next.length === 0) return;
    } else {
      if (current.length >= MAX_HOME_INDICATORS) return;
      next = [...current, key];
    }
    patch.mutate({ homeIndicators: next });
  }

  function moveIndicator(key: HomeIndicatorKey, direction: -1 | 1) {
    const current = [...selectedIndicators];
    const idx = current.indexOf(key);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= current.length) return;
    const tmp = current[idx]!;
    current[idx] = current[target]!;
    current[target] = tmp;
    patch.mutate({ homeIndicators: current });
  }

  useEffect(() => {
    if (!currentPlanId) return;
    if (!userPickedPlanRef.current) {
      setCheckoutPlanId(currentPlanId);
      return;
    }
    if (checkoutPlanId === currentPlanId) {
      userPickedPlanRef.current = false;
    }
  }, [checkoutPlanId, currentPlanId]);

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
                {sub?.cancelAtPeriodEnd ? " · cancela ao fim do período" : null}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              {planSeatPriceCaption(planDef)}. Vendedores ilimitados.{" "}
              {limits.includedAdmins} acesso
              {limits.includedAdmins === 1 ? "" : "s"} administrativo
              {limits.includedAdmins === 1 ? "" : "s"} incluso
              {limits.includedAdmins === 1 ? "" : "s"}; extra R$ 29,90/mês.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {isAdmin ? (
              <div className="flex flex-col gap-2 sm:items-end">
                <AppSelect
                  value={checkoutPlanId}
                  onValueChange={(v) => {
                    userPickedPlanRef.current = true;
                    setCheckoutPlanId(v as PlanId);
                  }}
                  options={listPlans().map((p) => ({
                    value: p.id,
                    label: `${p.name} — ${planSeatPriceCaption(p)}`,
                  }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canChangePlan || patch.isPending}
                  onClick={() => {
                    if (!canChangePlan) {
                      setCheckoutErr("Este já é o seu plano atual.");
                      return;
                    }
                    setCheckoutErr(null);
                    void apiFetch<{ checkoutUrl?: string | null; intentId?: string }>(
                      "/billing/checkout",
                      {
                        method: "POST",
                        body: JSON.stringify({ planId: checkoutPlanId }),
                      },
                    )
                      .then((data) => {
                        if (data.intentId) {
                          nav(
                            `/pagamento?intentId=${encodeURIComponent(data.intentId)}&change=plan`,
                          );
                        } else {
                          setCheckoutErr("Não foi possível iniciar a alteração de plano.");
                        }
                      })
                      .catch((ex: unknown) => {
                        setCheckoutErr(
                          ex instanceof Error
                            ? ex.message
                            : "Falha ao iniciar checkout",
                        );
                      });
                  }}
                >
                  {canChangePlan ? "Continuar para pagamento" : "Plano atual"}
                </Button>
                {!canChangePlan ? (
                  <p className="text-xs text-muted-foreground">
                    Selecione outro plano para alterar a assinatura.
                  </p>
                ) : null}
                {checkoutErr ? (
                  <p className="text-xs text-destructive">{checkoutErr}</p>
                ) : null}
                {sub?.provider === "asaas" ? (
                  <div className="flex flex-col gap-1 border-t border-border/50 pt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Asaas (admin)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={reconcileLoading}
                        onClick={() => {
                          setReconcileLoading(true);
                          setReconcileReport(null);
                          void apiFetch<BillingReconcileUiReport>(
                            "/billing/reconcile",
                            {
                              method: "POST",
                              body: JSON.stringify({ dryRun: true }),
                            },
                          )
                            .then(setReconcileReport)
                            .catch((ex: unknown) => {
                              setCheckoutErr(
                                ex instanceof Error
                                  ? ex.message
                                  : "Falha ao diagnosticar billing",
                              );
                            })
                            .finally(() => setReconcileLoading(false));
                        }}
                      >
                        Diagnosticar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={reconcileLoading}
                        onClick={() => {
                          setReconcileLoading(true);
                          setReconcileReport(null);
                          void apiFetch<BillingReconcileUiReport>(
                            "/billing/reconcile",
                            {
                              method: "POST",
                              body: JSON.stringify({ dryRun: false }),
                            },
                          )
                            .then(async (report) => {
                              setReconcileReport(report);
                              await refreshUser();
                            })
                            .catch((ex: unknown) => {
                              setCheckoutErr(
                                ex instanceof Error
                                  ? ex.message
                                  : "Falha ao reconciliar billing",
                              );
                            })
                            .finally(() => setReconcileLoading(false));
                        }}
                      >
                        Reconciliar
                      </Button>
                    </div>
                    {reconcileReport ? (
                      <div className="mt-1 max-w-sm rounded-md border border-border/60 bg-muted/30 p-2 text-xs text-muted-foreground">
                        {reconcileReport.dryRun ? (
                          <p className="font-medium text-foreground">
                            Diagnóstico (sem alterações)
                          </p>
                        ) : (
                          <p className="font-medium text-foreground">
                            Reconciliação aplicada
                          </p>
                        )}
                        {reconcileReport.fixed.length > 0 ? (
                          <ul className="mt-1 list-inside list-disc">
                            {reconcileReport.fixed.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        ) : null}
                        {reconcileReport.issues.length > 0 ? (
                          <ul className="mt-1 list-inside list-disc text-amber-700 dark:text-amber-400">
                            {reconcileReport.issues.map((i) => (
                              <li key={i}>{i}</li>
                            ))}
                          </ul>
                        ) : null}
                        {reconcileReport.duplicateCustomers.length > 0 ? (
                          <p className="mt-1">
                            {reconcileReport.duplicateCustomers.length}{" "}
                            clientes duplicados no Asaas (remova no sandbox os
                            sem assinatura).
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {isAdmin && sub && !sub.cancelAtPeriodEnd ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={patch.isPending}
                onClick={() => {
                  void apiFetch("/billing/cancel", { method: "POST" }).then(
                    () => {
                      void qc.invalidateQueries({
                        queryKey: ["admin", "system-settings"],
                      });
                      window.location.reload();
                    },
                  );
                }}
              >
                Cancelar renovação
              </Button>
            ) : null}
          </div>
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
            title="Inativação automática de clientes"
            description="Marca como inativo o cliente sem pedido confirmado há 6 meses. Ao comprar de novo, o status volta para ativo."
          >
            <label className="flex max-w-xl cursor-pointer items-start gap-3 text-sm text-foreground">
              <Checkbox
                className="mt-0.5"
                checked={settings?.autoInactivateCustomersAfterMonths ?? false}
                disabled={
                  isLoading || patch.isPending || settings === undefined
                }
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

          <FormSection
            title="Indicadores do painel"
            description={`Escolha até ${MAX_HOME_INDICATORS} indicadores exibidos na home. A ordem abaixo é a ordem no painel.`}
          >
            <div className="max-w-xl space-y-3">
              <FormField
                label="Tipo de visualização"
                htmlFor="home-indicators-layout"
                hint={
                  indicatorsLayout === "grid"
                    ? "Os gráficos ficam na mesma grade, lado a lado (até 3 colunas no desktop)."
                    : "Cada gráfico ocupa a largura inteira, um abaixo do outro."
                }
              >
                <AppSelect
                  id="home-indicators-layout"
                  value={indicatorsLayout}
                  disabled={
                    isLoading || patch.isPending || settings === undefined
                  }
                  options={HOME_INDICATORS_LAYOUTS.map((layout) => ({
                    value: layout,
                    label: HOME_INDICATORS_LAYOUT_LABELS[layout],
                  }))}
                  onValueChange={(v) =>
                    patch.mutate({
                      homeIndicatorsLayout: v as HomeIndicatorsLayout,
                    })
                  }
                />
              </FormField>
              <p className="text-xs text-muted-foreground">
                Selecionados: {selectedIndicators.length}/{MAX_HOME_INDICATORS}
                {selectedIndicators.length >= MAX_HOME_INDICATORS
                  ? " — desmarque um para escolher outro."
                  : null}
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {HOME_INDICATOR_KEYS.map((key) => {
                  const checked = selectedIndicators.includes(key);
                  const orderIdx = selectedIndicators.indexOf(key);
                  const atCap =
                    !checked &&
                    selectedIndicators.length >= MAX_HOME_INDICATORS;
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={
                          isLoading ||
                          patch.isPending ||
                          settings === undefined ||
                          atCap ||
                          (checked && selectedIndicators.length <= 1)
                        }
                        onCheckedChange={() => toggleIndicator(key)}
                      />
                      <span className="min-w-0 flex-1 text-sm text-foreground">
                        {HOME_INDICATOR_LABELS[key]}
                        {checked ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            #{orderIdx + 1}
                          </span>
                        ) : null}
                      </span>
                      {checked ? (
                        <span className="flex shrink-0 gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={
                              orderIdx <= 0 || patch.isPending || isLoading
                            }
                            onClick={() => moveIndicator(key, -1)}
                            aria-label="Mover para cima"
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={
                              orderIdx < 0 ||
                              orderIdx >= selectedIndicators.length - 1 ||
                              patch.isPending ||
                              isLoading
                            }
                            onClick={() => moveIndicator(key, 1)}
                            aria-label="Mover para baixo"
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                Rentabilidade = receita − custo do produto cadastrado. Itens sem
                custo aparecem com custo zero e são sinalizados no gráfico.
              </p>
            </div>
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
