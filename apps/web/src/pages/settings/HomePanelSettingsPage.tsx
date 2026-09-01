import { FormSection } from "@/components/forms";
import { HomeIndicatorCatalogDialog } from "@/components/home/HomeIndicatorCatalogDialog";
import { SettingsDetailShell } from "@/components/settings/SettingsDetailShell";
import { Button } from "@/components/ui/button";
import { useAdminSystemSettings } from "@/hooks/useAdminSystemSettings";
import {
  cheapestPlanWithHigherHomeIndicatorLimit,
  formatHomeIndicatorLimit,
  HOME_INDICATOR_LABELS,
  homeIndicatorLimitForPlan,
  type HomeIndicatorKey,
} from "@pedidos/shared";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function HomePanelSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { settings, isLoading, patch, selectedIndicators } =
    useAdminSystemSettings(Boolean(isAdmin));
  const [catalogOpen, setCatalogOpen] = useState(false);
  const indicatorLimit =
    settings?.homeIndicatorLimit ??
    homeIndicatorLimitForPlan(user?.subscription?.planId);
  const upgradePlan =
    cheapestPlanWithHigherHomeIndicatorLimit(indicatorLimit);
  const atCap =
    indicatorLimit != null && selectedIndicators.length >= indicatorLimit;
  const controlsDisabled =
    isLoading || patch.isPending || settings === undefined;

  function addIndicator(key: HomeIndicatorKey) {
    if (selectedIndicators.includes(key)) return;
    if (atCap) return;
    patch.mutate({ homeIndicators: [...selectedIndicators, key] });
  }

  function removeIndicator(key: HomeIndicatorKey) {
    if (selectedIndicators.length <= 1) return;
    patch.mutate({
      homeIndicators: selectedIndicators.filter((k) => k !== key),
    });
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

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/configuracoes" replace />;

  return (
    <SettingsDetailShell
      title="Indicadores do painel"
      description={`Escolha ${formatHomeIndicatorLimit(indicatorLimit)} exibidos na home. A ordem abaixo é a ordem na coluna de widgets.`}
    >
      <FormSection
        title="Widgets da home"
        description="Adicione e reordene os indicadores da coluna direita."
      >
        <div className="max-w-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Selecionados: {selectedIndicators.length}
              {indicatorLimit != null ? `/${indicatorLimit}` : null}
              {atCap ? " — remova um para adicionar outro." : null}
            </p>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={controlsDisabled || atCap}
              onClick={() => setCatalogOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              Adicionar indicador
            </Button>
          </div>
          {indicatorLimit != null &&
          selectedIndicators.length > indicatorLimit ? (
            <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              Há mais indicadores salvos do que o plano permite. A home exibe
              só os primeiros {indicatorLimit}. Desative os extras ou faça
              upgrade
              {upgradePlan ? ` para o plano ${upgradePlan.name}` : ""}.
            </p>
          ) : null}
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {selectedIndicators.map((key, orderIdx) => (
              <li key={key} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm text-foreground">
                  {HOME_INDICATOR_LABELS[key]}
                  <span className="ml-2 text-xs text-muted-foreground">
                    #{orderIdx + 1}
                  </span>
                </span>
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
                      orderIdx >= selectedIndicators.length - 1 ||
                      patch.isPending ||
                      isLoading
                    }
                    onClick={() => moveIndicator(key, 1)}
                    aria-label="Mover para baixo"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    disabled={
                      selectedIndicators.length <= 1 ||
                      patch.isPending ||
                      isLoading
                    }
                    onClick={() => removeIndicator(key)}
                    aria-label="Remover indicador"
                  >
                    <X className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Rentabilidade = receita − custo do produto cadastrado. Itens sem
            custo aparecem com custo zero e são sinalizados no gráfico.
          </p>
        </div>
      </FormSection>

      <HomeIndicatorCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        selectedKeys={selectedIndicators}
        atCap={atCap}
        disabled={controlsDisabled}
        onAdd={addIndicator}
      />

      {patch.isError ? (
        <p className="text-sm text-destructive">
          {(patch.error as Error).message || "Não foi possível salvar."}
        </p>
      ) : null}
    </SettingsDetailShell>
  );
}
