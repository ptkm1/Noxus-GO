import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
  const [ntScope, setNtScope] = useState<"org" | "seller">("org");
  const [ntSellerId, setNtSellerId] = useState("");
  const [ntThreshold, setNtThreshold] = useState("");
  const [ntPercent, setNtPercent] = useState("");
  const [ntLabel, setNtLabel] = useState("");
  const [ntPriority, setNtPriority] = useState("0");

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
      setNtThreshold("");
      setNtPercent("");
      setNtLabel("");
      setNtPriority("0");
      setNtSellerId("");
      setNtScope("org");
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
  const [mgSellerId, setMgSellerId] = useState("");
  const [mgYear, setMgYear] = useState(today.getFullYear());
  const [mgMonth, setMgMonth] = useState(today.getMonth() + 1);
  const [mgTitle, setMgTitle] = useState("Meta do mês");
  const [mgTarget, setMgTarget] = useState("");

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
      setMgTarget("");
      setMgTitle("Meta do mês");
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

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Comissões e metas</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Configure faixas de comissão progressiva pelo faturamento confirmado no mês (MTD) — globais da
          organização ou específicas por vendedor — e metas mensais exibidas no app do vendedor.
        </p>
      </div>

      {/* Faixas progressivas */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-slate-900">Faixas progressivas</h2>
        <p className="text-xs text-slate-500">
          Acima de cada valor de faturamento MTD (inclusive), aplica-se o percentual correspondente quando não há
          regra por produto/categoria mais específica. Prioridade maior resolve empates entre faixas.
        </p>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label className="text-sm text-slate-600">
            Filtrar escopo:
            <select
              className="ml-2 rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={tierScope}
              onChange={(e) => setTierScope(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="global">Somente organização</option>
              {activeSellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.user.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-medium text-slate-800">Nova faixa</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <label className="flex flex-col gap-1 text-xs text-slate-600 lg:col-span-2">
              Escopo
              <select
                className="rounded border px-2 py-2 text-sm"
                value={ntScope}
                onChange={(e) => setNtScope(e.target.value as "org" | "seller")}
              >
                <option value="org">Organização (todos)</option>
                <option value="seller">Um vendedor</option>
              </select>
            </label>
            {ntScope === "seller" ? (
              <label className="flex flex-col gap-1 text-xs text-slate-600 lg:col-span-2">
                Vendedor
                <select
                  className="rounded border px-2 py-2 text-sm"
                  value={ntSellerId}
                  onChange={(e) => setNtSellerId(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {activeSellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.user.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Limite MTD (R$)
              <input
                className="rounded border px-2 py-2 text-sm"
                placeholder="0"
                value={ntThreshold}
                onChange={(e) => setNtThreshold(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Comissão %
              <input
                className="rounded border px-2 py-2 text-sm"
                placeholder="ex: 5"
                value={ntPercent}
                onChange={(e) => setNtPercent(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Prioridade
              <input
                className="rounded border px-2 py-2 text-sm"
                value={ntPriority}
                onChange={(e) => setNtPriority(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600 lg:col-span-2">
              Rótulo (opcional)
              <input
                className="rounded border px-2 py-2 text-sm"
                placeholder="ex: Superação"
                value={ntLabel}
                onChange={(e) => setNtLabel(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded bg-brand-600 px-4 py-2 text-sm text-white lg:col-span-2"
              disabled={
                createTier.isPending ||
                !ntThreshold ||
                !ntPercent ||
                (ntScope === "seller" && !ntSellerId)
              }
              onClick={() => createTier.mutate()}
            >
              Adicionar faixa
            </button>
          </div>
          {createTier.error ? (
            <p className="mt-2 text-sm text-red-600">{(createTier.error as Error).message}</p>
          ) : null}
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando faixas…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Escopo</th>
                  <th className="px-4 py-3">Limite MTD (R$)</th>
                  <th className="px-4 py-3">%</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Rótulo</th>
                  <th className="px-4 py-3">Ativa</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {tiers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nenhuma faixa neste filtro.
                    </td>
                  </tr>
                ) : (
                  tiers.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 align-top">
                        <select
                          className="max-w-[200px] rounded border px-2 py-1 text-xs"
                          defaultValue={t.sellerId ?? ""}
                          key={`${t.id}-${t.sellerId ?? "org"}`}
                          onChange={(e) => {
                            const v = e.target.value;
                            patchTier.mutate({ id: t.id, sellerId: v === "" ? null : v });
                          }}
                        >
                          <option value="">Organização</option>
                          {activeSellers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.user.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          defaultChecked={t.active}
                          key={`${t.id}-act-${t.active}`}
                          onChange={(e) => patchTier.mutate({ id: t.id, active: e.target.checked })}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => {
                            if (confirm("Remover esta faixa?")) deleteTier.mutate(t.id);
                          }}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Metas mensais */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-slate-900">Metas mensais por vendedor</h2>
        <p className="text-xs text-slate-500">
          Uma meta por vendedor e mês civil. Salvar novamente atualiza valor e título (upsert).
        </p>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <label className="text-sm text-slate-600">
            Ano
            <input
              type="number"
              className="ml-2 w-24 rounded border px-2 py-1.5 text-sm"
              value={goalYear}
              min={2000}
              max={2100}
              onChange={(e) => setGoalYear(Number(e.target.value))}
            />
          </label>
          <label className="text-sm text-slate-600">
            Mês
            <select
              className="ml-2 rounded border px-2 py-1.5 text-sm capitalize"
              value={goalMonth}
              onChange={(e) => setGoalMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Vendedor
            <select
              className="ml-2 rounded border px-2 py-1.5 text-sm"
              value={goalSellerFilter}
              onChange={(e) => setGoalSellerFilter(e.target.value)}
            >
              <option value="">Todos neste mês</option>
              {activeSellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.user.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-medium text-slate-800">Definir ou atualizar meta</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <label className="flex flex-col gap-1 text-xs text-slate-600 lg:col-span-2">
              Vendedor
              <select
                className="rounded border px-2 py-2 text-sm"
                value={mgSellerId}
                onChange={(e) => setMgSellerId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {activeSellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Ano
              <input
                type="number"
                className="rounded border px-2 py-2 text-sm"
                value={mgYear}
                min={2000}
                max={2100}
                onChange={(e) => setMgYear(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Mês
              <select
                className="rounded border px-2 py-2 text-sm capitalize"
                value={mgMonth}
                onChange={(e) => setMgMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600 lg:col-span-2">
              Título
              <input
                className="rounded border px-2 py-2 text-sm"
                value={mgTitle}
                onChange={(e) => setMgTitle(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Meta (R$)
              <input
                className="rounded border px-2 py-2 text-sm"
                placeholder="0"
                value={mgTarget}
                onChange={(e) => setMgTarget(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded bg-brand-600 px-4 py-2 text-sm text-white"
              disabled={upsertGoal.isPending || !mgSellerId || !mgTarget}
              onClick={() => upsertGoal.mutate()}
            >
              Salvar meta
            </button>
          </div>
          {upsertGoal.error ? (
            <p className="mt-2 text-sm text-red-600">{(upsertGoal.error as Error).message}</p>
          ) : null}
        </div>

        {goalsLoading ? (
          <p className="text-slate-500">Carregando metas…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Meta (R$)</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {goals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Nenhuma meta para este filtro.
                    </td>
                  </tr>
                ) : (
                  goals.map((g) => (
                    <tr key={g.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">{g.seller.user.name}</td>
                      <td className="px-4 py-3 capitalize">
                        {monthLabel(g.month)} {g.year}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-full max-w-[220px] rounded border px-2 py-1 text-xs"
                          defaultValue={g.title}
                          key={`${g.id}-title-${g.title}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== g.title) patchGoal.mutate({ id: g.id, title: v });
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => {
                            if (confirm("Remover esta meta?")) deleteGoal.mutate(g.id);
                          }}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
