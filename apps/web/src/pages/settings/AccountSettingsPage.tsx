import { FormSection } from "@/components/forms";
import { SettingsDetailShell } from "@/components/settings/SettingsDetailShell";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getPlanDefinition,
  listPlans,
  planSeatPriceCaption,
  type PlanId,
} from "@pedidos/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { apiFetch } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  TRIAL: "Período de teste",
  ACTIVE: "Ativo",
  PAST_DUE: "Em atraso",
  CANCELED: "Cancelado",
  INCOMPLETE: "Incompleto",
};

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

export function AccountSettingsPage() {
  const { user, refreshUser } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [checkoutPlanId, setCheckoutPlanId] = useState<PlanId>(
    (user?.subscription?.planId as PlanId) ?? "pro",
  );
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);
  const userPickedPlanRef = useRef(false);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileReport, setReconcileReport] =
    useState<BillingReconcileUiReport | null>(null);
  const [cancelPending, setCancelPending] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  const planDef = getPlanDefinition(user?.subscription?.planId);
  const sub = user?.subscription;
  const currentPlanId = (sub?.planId as PlanId | undefined) ?? null;
  const isPaidActive = sub?.status === "ACTIVE";
  const isTrial = sub?.status === "TRIAL";
  const isSamePlanSelected =
    currentPlanId !== null && checkoutPlanId === currentPlanId;
  const canChangePlan = isTrial || !isSamePlanSelected || !isPaidActive;
  let checkoutButtonLabel = "Plano atual";
  if (isTrial && isSamePlanSelected) checkoutButtonLabel = "Assinar agora";
  else if (canChangePlan) checkoutButtonLabel = "Continuar para pagamento";
  const periodEnd = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")
    : null;
  const statusLabel = STATUS_LABELS[sub?.status ?? ""] ?? sub?.status ?? "—";
  const limits = sub?.limits ?? planDef.limits;

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

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/configuracoes" replace />;

  return (
    <SettingsDetailShell
      title="Plano e assinatura"
      description="Assinatura da organização, limites do plano e cobrança."
    >
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
              {planSeatPriceCaption(planDef)}. Vendedores ilimitados.{" "}
              {limits.includedAdmins} acesso
              {limits.includedAdmins === 1 ? "" : "s"} administrativo
              {limits.includedAdmins === 1 ? "" : "s"} incluso
              {limits.includedAdmins === 1 ? "" : "s"}; extra R$ 29,90/mês.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
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
                disabled={!canChangePlan || cancelPending}
                onClick={() => {
                  if (!canChangePlan) {
                    setCheckoutErr("Este já é o seu plano atual.");
                    return;
                  }
                  setCheckoutErr(null);
                  void apiFetch<{
                    checkoutUrl?: string | null;
                    intentId?: string;
                  }>("/billing/checkout", {
                    method: "POST",
                    body: JSON.stringify({ planId: checkoutPlanId }),
                  })
                    .then((data) => {
                      if (data.intentId) {
                        const q = isTrial
                          ? `?intentId=${encodeURIComponent(data.intentId)}`
                          : `?intentId=${encodeURIComponent(data.intentId)}&change=plan`;
                        nav(`/pagamento${q}`);
                      } else {
                        setCheckoutErr(
                          "Não foi possível iniciar a alteração de plano.",
                        );
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
                {checkoutButtonLabel}
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
                          {reconcileReport.duplicateCustomers.length} clientes
                          duplicados no Asaas (remova no sandbox os sem
                          assinatura).
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {sub && !sub.cancelAtPeriodEnd ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={cancelPending}
                onClick={() => {
                  setCancelPending(true);
                  void apiFetch("/billing/cancel", { method: "POST" })
                    .then(() => {
                      void qc.invalidateQueries({
                        queryKey: ["admin", "system-settings"],
                      });
                      window.location.reload();
                    })
                    .finally(() => setCancelPending(false));
                }}
              >
                Cancelar renovação
              </Button>
            ) : null}
          </div>
        </div>
      </FormSection>
    </SettingsDetailShell>
  );
}
