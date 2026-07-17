import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useConfirm } from "@/components/confirm";
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

function monthLabel(m: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(2024, m - 1, 1),
  );
}

type Seller = {
  id: string;
  active: boolean;
  user: { name: string; email: string };
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

export function CommissionGoalsPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const today = new Date();

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const activeSellers = useMemo(() => sellers.filter((s) => s.active), [sellers]);

  const [goalYear, setGoalYear] = useState(today.getFullYear());
  const [goalMonth, setGoalMonth] = useState(today.getMonth() + 1);
  const [goalSellerFilter, setGoalSellerFilter] = useState<string>("");

  const goalsQueryKey = [
    "admin",
    "seller-monthly-goals",
    goalYear,
    goalMonth,
    goalSellerFilter,
  ] as const;

  const { data: goalsRaw = [], isLoading: goalsLoading } = useQuery({
    queryKey: goalsQueryKey,
    queryFn: () => {
      const q = new URLSearchParams({
        year: String(goalYear),
        month: String(goalMonth),
      });
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
          ...(body.targetAmount !== undefined
            ? { targetAmount: body.targetAmount }
            : {}),
        }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "seller-monthly-goals"] }),
  });

  const deleteGoal = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/seller-monthly-goals/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "seller-monthly-goals"] }),
  });

  const canSaveGoal = Boolean(mgSellerId && mgTarget);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <nav className="text-sm text-muted-foreground">
            <Link to="/comissao" className="hover:text-foreground">
              Comissões e metas
            </Link>
            <span className="mx-1.5">›</span>
            <span className="text-foreground">Metas</span>
          </nav>
          <h1 className="text-2xl font-semibold text-foreground">Metas</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Uma meta por vendedor e mês civil. Salvar novamente atualiza valor e
            título (upsert).
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
            <Input
              id="mg-title"
              value={mgTitle}
              onChange={(e) => setMgTitle(e.target.value)}
            />
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
          <p className="mt-3 text-sm text-destructive">
            {(upsertGoal.error as Error).message}
          </p>
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
                  <TableCell
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
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
                          void confirm({
                            title: "Remover meta?",
                            description:
                              "Esta meta de comissão será excluída permanentemente.",
                            confirmLabel: "Remover",
                            tone: "destructive",
                          }).then((ok) => {
                            if (ok) deleteGoal.mutate(g.id);
                          });
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
    </div>
  );
}
