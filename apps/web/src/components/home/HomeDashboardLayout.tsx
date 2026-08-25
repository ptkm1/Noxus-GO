import { HomeSlot } from "@/components/home/HomeSlot";

const KPI_LABELS = ["KPI 1", "KPI 2", "KPI 3", "KPI 4"] as const;

/**
 * Grade estrutural da home (Início).
 * Apenas slots — widgets reais entram depois.
 */
export function HomeDashboardLayout() {
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

      {/* Linha de 4 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_LABELS.map((label) => (
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
          <HomeSlot
            label="Gráfico principal"
            minHeightClassName="min-h-[18rem]"
          />
          <HomeSlot
            label="Tabela / lista"
            minHeightClassName="min-h-[14rem]"
          />
        </div>

        <div className="flex flex-col gap-4">
          <HomeSlot label="Widget" minHeightClassName="min-h-[10rem]" />
          <HomeSlot label="Widget" minHeightClassName="min-h-[10rem]" />
          <HomeSlot label="Widget" minHeightClassName="min-h-[10rem]" />
        </div>
      </div>
    </div>
  );
}
