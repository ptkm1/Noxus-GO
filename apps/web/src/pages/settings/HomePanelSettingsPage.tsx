import { FormSection } from "@/components/forms";
import { SettingsDetailShell } from "@/components/settings/SettingsDetailShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdminSystemSettings } from "@/hooks/useAdminSystemSettings";
import {
  cheapestPlanWithHigherHomeIndicatorLimit,
  formatHomeIndicatorLimit,
  HOME_INDICATOR_KEYS,
  HOME_INDICATOR_LABELS,
  homeIndicatorLimitForPlan,
  type HomeIndicatorKey,
} from "@pedidos/shared";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function HomePanelSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { settings, isLoading, patch, selectedIndicators } =
    useAdminSystemSettings(Boolean(isAdmin));
  const indicatorLimit =
    settings?.homeIndicatorLimit ??
    homeIndicatorLimitForPlan(user?.subscription?.planId);
  const upgradePlan =
    cheapestPlanWithHigherHomeIndicatorLimit(indicatorLimit);

  function toggleIndicator(key: HomeIndicatorKey) {
    const current = selectedIndicators;
    const exists = current.includes(key);
    let next: HomeIndicatorKey[];
    if (exists) {
      next = current.filter((k) => k !== key);
      if (next.length === 0) return;
    } else {
      if (indicatorLimit != null && current.length >= indicatorLimit) return;
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

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/configuracoes" replace />;

  return (
    <SettingsDetailShell
      title="Indicadores do painel"
      description={`Escolha ${formatHomeIndicatorLimit(indicatorLimit)} exibidos na home. A ordem abaixo é a ordem na coluna de widgets.`}
    >
      <FormSection
        title="Widgets da home"
        description="Marque e reordene os indicadores da coluna direita."
      >
        <div className="max-w-xl space-y-3">
          <p className="text-xs text-muted-foreground">
            Selecionados: {selectedIndicators.length}
            {indicatorLimit != null ? `/${indicatorLimit}` : null}
            {indicatorLimit != null &&
            selectedIndicators.length >= indicatorLimit
              ? " — desmarque um para escolher outro."
              : null}
          </p>
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
            {HOME_INDICATOR_KEYS.map((key) => {
              const checked = selectedIndicators.includes(key);
              const orderIdx = selectedIndicators.indexOf(key);
              const atCap =
                !checked &&
                indicatorLimit != null &&
                selectedIndicators.length >= indicatorLimit;
              return (
                <li key={key} className="flex items-center gap-3 px-3 py-2.5">
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
      {patch.isError ? (
        <p className="text-sm text-destructive">
          {(patch.error as Error).message || "Não foi possível salvar."}
        </p>
      ) : null}
    </SettingsDetailShell>
  );
}
