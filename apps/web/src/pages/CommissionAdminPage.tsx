import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  FilterBar,
  FormField,
  FormGrid,
  FormSheet,
  FormSheetActions,
} from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "../lib/api";

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

type Seller = {
  id: string;
  active: boolean;
  user: { name: string; email: string };
};

type ProgressiveTierRow = {
  id: string;
  sellerId: string | null;
  thresholdAmount: unknown;
  commissionPercent: unknown;
  label: string | null;
  priority: number;
  active: boolean;
  seller?: { user: { name: string } } | null;
};

type MonthlyGoalRow = {
  id: string;
  sellerId: string;
  year: number;
  month: number;
  title: string;
  targetAmount: unknown;
  seller: { user: { name: string } };
};

function monthLabel(m: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, m - 1, 1));
}

export function CommissionAdminPage() {
  const qc = useQueryClient();
  const today = new Date();

  const { data: sellers = [], isLoading: sellersLoading } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const activeSellers = useMemo(() => sellers.filter((s) => s.active), [sellers]);

  const [tierScope, setTierScope] = useState<string>("all");

  const { data: tiersRaw = [], isLoading: tiersLoading } = useQuery({
    queryKey: ["admin", "commission-progressive-tiers"],
    queryFn: () => apiFetch<ProgressiveTierRow[]>("/admin/commission-progressive-tiers"),
  });

  const tiers = useMemo(() => {
    let rows = tiersRaw;
    if (tierScope === "global") rows = rows.filter((t) => t.sellerId == null);
    else if (tierScope !== "all") rows = rows.filter((t) => t.sellerId === tierScope);
    return [...rows].sort((a, b) => {
      const ak = a.sellerId ?? "";
      const bk = b.sellerId ?? "";
      if (ak !== bk) return ak.localeCompare(bk);
      return num(a.thresholdAmount) - num(b.thresholdAmount);
    });
  }, [tiersRaw, tierScope]);

  const [goalYear, setGoalYear] = useState(today.getFullYear());
  const [goalMonth, setGoalMonth] = useState(today.getMonth() + 1);
  const [goalSellerFilter, setGoalSellerFilter] = useState<string>("");

  const goalsQueryKey = ["admin", "seller-monthly-goals", goalYear, goalMonth, goalSellerFilter] as const;

  const { data: goalsRaw = [], isLoading: goalsLoading } = useQuery({
    queryKey: goalsQueryKey,
    queryFn: () => {
      const q = new URLSearchParams({ year: String(goalYear), month: String(goalMonth) });
      if (goalSellerFilter) q.set("sellerId", goalSellerFilter);
      return apiFetch<MonthlyGoalRow[]>(`/admin/seller-monthly-goals?${q}`);
    },
  });

  const goals = useMemo(
    () =>
      [...goalsRaw].sort((a, b) =>
        a.seller.user.name.localeCompare(b.seller.user.name, "pt-BR"),
      ),
    [goalsRaw],
  );

  /* --- Nova faixa progressiva --- */
  const [tierSheetOpen, setTierSheetOpen] = useState(false);
  const [ntScope, setNtScope] = useState<"org" | "seller">("org");
  const [ntSellerId, setNtSellerId] = useState("");
  const [ntThreshold, setNtThreshold] = useState("");
  const [ntPercent, setNtPercent] = useState("");
  const [ntLabel, setNtLabel] = useState("");
  const [ntPriority, setNtPriority] = useState("0");

  function resetTierForm() {
    setNtThreshold("");
    setNtPercent("");
    setNtLabel("");
    setNtPriority("0");
    setNtSellerId("");
    setNtScope("org");
  }

  function openTierCreate() {
    resetTierForm();
    setTierSheetOpen(true);
  }

  function closeTierSheet() {
    setTierSheetOpen(false);
    resetTierForm();
  }

  const createTier = useMutation({
    mutationFn: () =>
      apiFetch("/admin/commission-progressive-tiers", {
        method: "POST",
        body: JSON.stringify({
          sellerId: ntScope === "org" ? null : ntSellerId || null,
          thresholdAmount: Number(ntThreshold.replace(",", ".")),
          commissionPercent: Number(ntPercent.replace(",", ".")),
          label: ntLabel.trim() ? ntLabel.trim() : null,
          priority: Number(ntPriority) || 0,
          active: true,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "commission-progressive-tiers"] });
      closeTierSheet();
    },
  });

  const patchTier = useMutation({
    mutationFn: (body: {
      id: string;
      sellerId?: string | null;
      thresholdAmount?: number;
      commissionPercent?: number;
      label?: string | null;
      priority?: number;
      active?: boolean;
    }) => {
      const { id, ...rest } = body;
      return apiFetch(`/admin/commission-progressive-tiers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "commission-progressive-tiers"] }),
  });

  const deleteTier = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/commission-progressive-tiers/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "commission-progressive-tiers"] }),
  });

  /* --- Metas mensais --- */
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [mgSellerId, setMgSellerId] = useState("");
  const [mgYear, setMgYear] = useState(today.getFullYear());
  const [mgMonth, setMgMonth] = useState(today.getMonth() + 1);
  const [mgTitle, setMgTitle] = useState("Meta do mês");
  const [mgTarget, setMgTarget] = useState("");

  function resetGoalForm() {
    setMgSellerId("");
    setMgYear(today.getFullYear());
    setMgMonth(today.getMonth() + 1);
    setMgTitle("Meta do mês");
    setMgTarget("");
  }

  function openGoalCreate() {
    resetGoalForm();
    setGoalSheetOpen(true);
  }

  function closeGoalSheet() {
    setGoalSheetOpen(false);
    resetGoalForm();
  }

  const upsertGoal = useMutation({
    mutationFn: () =>
      apiFetch("/admin/seller-monthly-goals", {
        method: "POST",
        body: JSON.stringify({
          sellerId: mgSellerId,
          year: mgYear,
          month: mgMonth,
          title: mgTitle.trim() || "Meta do mês",
          targetAmount: Number(mgTarget.replace(",", ".")),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "seller-monthly-goals"] });
      closeGoalSheet();
    },
  });

  const patchGoal = useMutation({
    mutationFn: (body: { id: string; title?: string; targetAmount?: number }) =>
      apiFetch(`/admin/seller-monthly-goals/${body.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.targetAmount !== undefined ? { targetAmount: body.targetAmount } : {}),
        }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "seller-monthly-goals"] }),
  });

  const deleteGoal = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/seller-monthly-goals/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "seller-monthly-goals"] }),
  });

  const loading = sellersLoading || tiersLoading;

  const canSaveTier =
    Boolean(ntThreshold && ntPercent) && !(ntScope === "seller" && !ntSellerId);

  const canSaveGoal = Boolean(mgSellerId && mgTarget);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Comissões e metas</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Configure faixas de comissão progressiva pelo faturamento confirmado no mês (MTD) — globais da
          organização ou específicas por vendedor — e metas mensais exibidas no app do vendedor.
        </p>
      </div>

      {/* Faixas progressivas */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-foreground">Faixas progressivas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Acima de cada valor de faturamento MTD (inclusive), aplica-se o percentual correspondente quando não há
              regra por produto/categoria mais específica. Prioridade maior resolve empates entre faixas.
            </p>
          </div>
          <Button type="button" className="shrink-0" onClick={openTierCreate}>
            Nova faixa
          </Button>
        </div>

        <FilterBar className="max-w-md px-4 py-3">
          <FormField label="Filtrar escopo" htmlFor="tier-scope-filter">
            <AppSelect
              id="tier-scope-filter"
              value={tierScope}
              options={[
                { value: "all", label: "Todos" },
                { value: "global", label: "Somente organização" },
                ...activeSellers.map((s) => ({
                  value: s.id,
                  label: s.user.name,
                })),
              ]}
              onValueChange={setTierScope}
            />
          </FormField>
        </FilterBar>

        <FormSheet
          open={tierSheetOpen}
          onOpenChange={(open) => {
            if (!open) closeTierSheet();
            else setTierSheetOpen(true);
          }}
          title="Nova faixa"
          description="Comissão progressiva por faturamento MTD."
          footer={
            <FormSheetActions
              onCancel={closeTierSheet}
              onSubmit={() => createTier.mutate()}
              submitLabel="Adicionar faixa"
              pending={createTier.isPending}
              disabled={!canSaveTier}
            />
          }
        >
          <FormGrid cols={2}>
            <FormField label="Escopo" htmlFor="nt-scope">
              <AppSelect
                id="nt-scope"
                value={ntScope}
                options={[
                  { value: "org", label: "Organização (todos)" },
                  { value: "seller", label: "Um vendedor" },
                ]}
                onValueChange={(v) => setNtScope(v as "org" | "seller")}
              />
            </FormField>
            {ntScope === "seller" ? (
              <FormField label="Vendedor" htmlFor="nt-seller">
                <AppSelect
                  id="nt-seller"
                  value={ntSellerId}
                  emptyLabel="Selecione…"
                  placeholder="Selecione…"
                  options={activeSellers.map((s) => ({
                    value: s.id,
                    label: s.user.name,
                  }))}
                  onValueChange={setNtSellerId}
                />
              </FormField>
            ) : null}
            <FormField label="Limite MTD (R$)" htmlFor="nt-threshold" required>
              <Input
                id="nt-threshold"
                placeholder="0"
                value={ntThreshold}
                onChange={(e) => setNtThreshold(e.target.value)}
              />
            </FormField>
            <FormField label="Comissão %" htmlFor="nt-percent" required>
              <Input
                id="nt-percent"
                placeholder="ex: 5"
                value={ntPercent}
                onChange={(e) => setNtPercent(e.target.value)}
              />
            </FormField>
            <FormField label="Prioridade" htmlFor="nt-priority">
              <Input
                id="nt-priority"
                value={ntPriority}
                onChange={(e) => setNtPriority(e.target.value)}
              />
            </FormField>
            <FormField label="Rótulo (opcional)" htmlFor="nt-label" className="sm:col-span-2">
              <Input
                id="nt-label"
                placeholder="ex: Superação"
                value={ntLabel}
                onChange={(e) => setNtLabel(e.target.value)}
              />
            </FormField>
          </FormGrid>
          {createTier.error ? (
            <p className="mt-3 text-sm text-destructive">{(createTier.error as Error).message}</p>
          ) : null}
        </FormSheet>

        {loading ? (
          <p className="text-muted-foreground">Carregando faixas…</p>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <Table className="min-w-[840px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Escopo</TableHead>
                  <TableHead className="px-4">Limite MTD (R$)</TableHead>
                  <TableHead className="px-4">%</TableHead>
                  <TableHead className="px-4">Prioridade</TableHead>
                  <TableHead className="px-4">Rótulo</TableHead>
                  <TableHead className="px-4">Ativa</TableHead>
                  <TableHead className="px-4 w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma faixa neste filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  tiers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="px-4 py-3 align-top">
                        <AppSelect
                          key={`${t.id}-${t.sellerId ?? "org"}`}
                          value={t.sellerId ?? ""}
                          emptyLabel="Organização"
                          placeholder="Organização"
                          triggerClassName="max-w-[200px] text-xs"
                          options={activeSellers.map((s) => ({
                            value: s.id,
                            label: s.user.name,
                          }))}
                          onValueChange={(v) => {
                            patchTier.mutate({ id: t.id, sellerId: v === "" ? null : v });
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-28 rounded border px-2 py-1"
                          defaultValue={num(t.thresholdAmount)}
                          key={`${t.id}-thr-${t.thresholdAmount}`}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v) && v !== num(t.thresholdAmount)) {
                              patchTier.mutate({ id: t.id, thresholdAmount: v });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="w-20 rounded border px-2 py-1"
                          defaultValue={num(t.commissionPercent)}
                          key={`${t.id}-pct-${t.commissionPercent}`}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v) && v !== num(t.commissionPercent)) {
                              patchTier.mutate({ id: t.id, commissionPercent: v });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <input
                          type="number"
                          className="w-16 rounded border px-2 py-1"
                          defaultValue={t.priority}
                          key={`${t.id}-pri-${t.priority}`}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v) && Number.isInteger(v) && v !== t.priority) {
                              patchTier.mutate({ id: t.id, priority: v });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <input
                          className="w-full max-w-[160px] rounded border px-2 py-1 text-xs"
                          defaultValue={t.label ?? ""}
                          key={`${t.id}-lbl-${t.label ?? ""}`}
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            const next = raw === "" ? null : raw;
                            const prev = t.label ?? null;
                            if (next !== prev) patchTier.mutate({ id: t.id, label: next });
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <input
                          type="checkbox"
                          defaultChecked={t.active}
                          key={`${t.id}-act-${t.active}`}
                          onChange={(e) => patchTier.mutate({ id: t.id, active: e.target.checked })}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs text-destructive hover:underline"
                          onClick={() => {
                            if (confirm("Remover esta faixa?")) deleteTier.mutate(t.id);
                          }}
                        >
                          Excluir
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Metas mensais */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-foreground">Metas mensais por vendedor</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Uma meta por vendedor e mês civil. Salvar novamente atualiza valor e título (upsert).
            </p>
          </div>
          <Button type="button" className="shrink-0" onClick={openGoalCreate}>
            Definir meta
          </Button>
        </div>

        <FilterBar className="px-4 py-3">
          <FormField label="Ano" htmlFor="goal-year">
            <Input
              id="goal-year"
              type="number"
              value={goalYear}
              min={2000}
              max={2100}
              onChange={(e) => setGoalYear(Number(e.target.value))}
            />
          </FormField>
          <FormField label="Mês" htmlFor="goal-month">
            <AppSelect
              id="goal-month"
              value={String(goalMonth)}
              triggerClassName="capitalize"
              options={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
                value: String(m),
                label: monthLabel(m),
              }))}
              onValueChange={(v) => setGoalMonth(Number(v))}
            />
          </FormField>
          <FormField label="Vendedor" htmlFor="goal-seller-filter" className="sm:col-span-2">
            <AppSelect
              id="goal-seller-filter"
              value={goalSellerFilter}
              emptyLabel="Todos neste mês"
              placeholder="Todos neste mês"
              options={activeSellers.map((s) => ({
                value: s.id,
                label: s.user.name,
              }))}
              onValueChange={setGoalSellerFilter}
            />
          </FormField>
        </FilterBar>

        <FormSheet
          open={goalSheetOpen}
          onOpenChange={(open) => {
            if (!open) closeGoalSheet();
            else setGoalSheetOpen(true);
          }}
          title="Definir ou atualizar meta"
          description="Uma meta por vendedor e mês civil (upsert)."
          footer={
            <FormSheetActions
              onCancel={closeGoalSheet}
              onSubmit={() => upsertGoal.mutate()}
              submitLabel="Salvar meta"
              pending={upsertGoal.isPending}
              disabled={!canSaveGoal}
            />
          }
        >
          <FormGrid cols={2}>
            <FormField label="Vendedor" htmlFor="mg-seller" required className="sm:col-span-2">
              <AppSelect
                id="mg-seller"
                value={mgSellerId}
                emptyLabel="Selecione…"
                placeholder="Selecione…"
                options={activeSellers.map((s) => ({
                  value: s.id,
                  label: s.user.name,
                }))}
                onValueChange={setMgSellerId}
              />
            </FormField>
            <FormField label="Ano" htmlFor="mg-year">
              <Input
                id="mg-year"
                type="number"
                value={mgYear}
                min={2000}
                max={2100}
                onChange={(e) => setMgYear(Number(e.target.value))}
              />
            </FormField>
            <FormField label="Mês" htmlFor="mg-month">
              <AppSelect
                id="mg-month"
                value={String(mgMonth)}
                triggerClassName="capitalize"
                options={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
                  value: String(m),
                  label: monthLabel(m),
                }))}
                onValueChange={(v) => setMgMonth(Number(v))}
              />
            </FormField>
            <FormField label="Título" htmlFor="mg-title" className="sm:col-span-2">
              <Input id="mg-title" value={mgTitle} onChange={(e) => setMgTitle(e.target.value)} />
            </FormField>
            <FormField label="Meta (R$)" htmlFor="mg-target" required className="sm:col-span-2">
              <Input
                id="mg-target"
                placeholder="0"
                value={mgTarget}
                onChange={(e) => setMgTarget(e.target.value)}
              />
            </FormField>
          </FormGrid>
          {upsertGoal.error ? (
            <p className="mt-3 text-sm text-destructive">{(upsertGoal.error as Error).message}</p>
          ) : null}
        </FormSheet>

        {goalsLoading ? (
          <p className="text-muted-foreground">Carregando metas…</p>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Vendedor</TableHead>
                  <TableHead className="px-4">Período</TableHead>
                  <TableHead className="px-4">Título</TableHead>
                  <TableHead className="px-4">Meta (R$)</TableHead>
                  <TableHead className="px-4 w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma meta para este filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  goals.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="px-4 py-3">{g.seller.user.name}</TableCell>
                      <TableCell className="px-4 py-3 capitalize">
                        {monthLabel(g.month)} {g.year}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <input
                          className="w-full max-w-[220px] rounded border px-2 py-1 text-xs"
                          defaultValue={g.title}
                          key={`${g.id}-title-${g.title}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== g.title) patchGoal.mutate({ id: g.id, title: v });
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-28 rounded border px-2 py-1"
                          defaultValue={num(g.targetAmount)}
                          key={`${g.id}-tgt-${g.targetAmount}`}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v) && v > 0 && v !== num(g.targetAmount)) {
                              patchGoal.mutate({ id: g.id, targetAmount: v });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs text-destructive hover:underline"
                          onClick={() => {
                            if (confirm("Remover esta meta?")) deleteGoal.mutate(g.id);
                          }}
                        >
                          Excluir
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
