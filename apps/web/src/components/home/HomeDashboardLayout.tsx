import { HomeSlot } from "@/components/home/HomeSlot";
import type { ReactNode } from "react";

type HomeDashboardLayoutProps = {
  /** Três resumos no topo (KPI 1–3). Se omitido, mostra placeholders. */
  kpis?: ReactNode;
  /** Gráfico principal (área esquerda superior). Se omitido, mostra placeholder. */
  mainChart?: ReactNode;
  /** Lista/tabela no corpo esquerdo. Se omitido, mostra placeholder. */
  ordersList?: ReactNode;
  /** Três widgets da coluna direita. Se omitido, mostra placeholders. */
  sideWidgets?: ReactNode;
};

/**
 * Grade estrutural da home (Início).
 * KPIs, gráfico, lista e widgets laterais podem receber conteúdo real.
 */
export function HomeDashboardLayout({
  kpis,
  mainChart,
  ordersList,
  sideWidgets,
}: Readonly<HomeDashboardLayoutProps>) {
  return (
    <div className="space-y-4 md:space-y-5">
      {/* Topo: título + controles (placeholders) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Início
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 min-w-[9.5rem] items-center rounded-lg border border-dashed border-border bg-card px-3 text-xs text-muted-foreground/70">
            Filtro de data
          </div>
          <div className="flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-dashed border-border bg-card px-3 text-xs text-muted-foreground/70">
            Ações
          </div>
        </div>
      </div>

      {/* Linha de 3 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis ??
          (["KPI 1", "KPI 2", "KPI 3"] as const).map((label) => (
            <HomeSlot
              key={label}
              label={label}
              minHeightClassName="min-h-[6.5rem]"
            />
          ))}
      </div>

      {/* Corpo: ~2/3 + ~1/3 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {mainChart ?? (
            <HomeSlot
              label="Gráfico principal"
              minHeightClassName="min-h-[18rem]"
            />
          )}
          {ordersList ?? (
            <HomeSlot
              label="Tabela / lista"
              minHeightClassName="min-h-[14rem]"
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          {sideWidgets ?? (
            <>
              <HomeSlot label="Widget" minHeightClassName="min-h-[10rem]" />
              <HomeSlot label="Widget" minHeightClassName="min-h-[10rem]" />
              <HomeSlot label="Widget" minHeightClassName="min-h-[10rem]" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
