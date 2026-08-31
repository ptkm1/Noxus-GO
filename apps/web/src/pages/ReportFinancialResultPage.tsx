import { useAuth } from "@/auth/AuthContext";
import { ReportField } from "@/components/reports/ReportFormKit";
import {
  fmtMoney,
  ReportDataLayout,
  SellerFilterField,
  useReportSellers,
} from "@/components/reports/ReportDataKit";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { apiFetch, downloadPdf, printPdf } from "@/lib/api";
import {
  CUSTOM_PERIOD_LABEL,
  PERIOD_PRESET_LABELS,
  periodRangeYmd,
  type PeriodPreset,
  validateCustomPeriod,
  ymdToIsoRange,
} from "@/lib/period-presets";
import { cn } from "@/lib/utils";
import { canRead } from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { Printer, FileDown } from "lucide-react";
import { useMemo, useState } from "react";

type PeriodChoice = PeriodPreset | "today" | "this_week" | "custom";

const PERIOD_BUTTONS: Array<{ id: PeriodChoice; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "this_week", label: "Esta semana" },
  { id: "this_month", label: PERIOD_PRESET_LABELS.this_month },
  { id: "last_month", label: PERIOD_PRESET_LABELS.last_month },
  { id: "last_7_days", label: PERIOD_PRESET_LABELS.last_7_days },
  { id: "last_90_days", label: PERIOD_PRESET_LABELS.last_90_days },
  { id: "custom", label: CUSTOM_PERIOD_LABEL },
];

type PeriodGroup = "day" | "week" | "month";
type DetailTab = "order" | "seller" | "supplier" | "product" | "period";

type Totals = {
  orderCount: number;
  revenue: number;
  avgTicket: number;
  productCost: number;
  commission: number;
  profit: number;
  marginPct: number;
  fixedCosts: number;
  finalProfit: number;
  finalMarginPct: number;
  linesMissingCost: number;
};

type GroupRow = {
  id: string;
  label: string;
  orderCount: number;
  revenue: number;
  productCost: number;
  commission: number;
  profit: number;
  marginPct: number;
};

type OrderRow = {
  orderId: string;
  orderNumber: string;
  date: string;
  customer: string;
  seller: string;
  revenue: number;
  productCost: number;
  commission: number;
  profit: number;
  marginPct: number;
};

type FinancialResult = {
  includeFixedCosts: boolean;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  criteria: string;
  totals: Totals;
  previous: Totals;
  evolution: {
    revenuePct: number | null;
    profitPct: number | null;
    finalProfitPct: number | null;
    marginPctPoints: number;
  };
  byOrder: OrderRow[];
  bySeller: GroupRow[];
  bySupplier: GroupRow[];
  byProduct: GroupRow[];
  byPeriod: GroupRow[];
};

function fmtPct(n: number): string {
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function fmtBrl(n: number): string {
  return `R$ ${fmtMoney(n)}`;
}

function fmtRange(fromIso: string, toIso: string): string {
  return `${new Date(fromIso).toLocaleDateString("pt-BR")} — ${new Date(toIso).toLocaleDateString("pt-BR")}`;
}

function evoLabel(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmtPct(n)}`;
}

function thisWeekYmd(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  const y = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: y(monday), to: y(now) };
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function KpiCard({
  label,
  value,
  hint,
  negative,
  emphasize,
}: {
  label: string;
  value: string;
  hint?: string;
  negative?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        emphasize
          ? "border-amber-400/80 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-border",
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          negative ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function MoneyCell({ n }: { n: number }) {
  return (
    <TableCell
      className={cn(
        "px-4 py-2 text-right tabular-nums",
        n < 0 && "text-destructive",
      )}
    >
      {fmtBrl(n)}
    </TableCell>
  );
}

function PctCell({ n }: { n: number }) {
  return (
    <TableCell
      className={cn(
        "px-4 py-2 text-right tabular-nums",
        n < 0 && "text-destructive",
      )}
    >
      {fmtPct(n)}
    </TableCell>
  );
}

export function ReportFinancialResultPage() {
  const { user } = useAuth();
  const canViewProfit = Boolean(
    user && canRead(user.role, "reports_profit_percent", user.permissions),
  );
  const { data: sellers = [] } = useReportSellers();
  const [preset, setPreset] = useState<PeriodChoice>("this_month");
  const [customFrom, setCustomFrom] = useState(() => periodRangeYmd("this_month").from);
  const [customTo, setCustomTo] = useState(() => periodRangeYmd("this_month").to);
  const [sellerId, setSellerId] = useState("");
  const [includeFixedCosts, setIncludeFixedCosts] = useState(false);
  const [periodGroup, setPeriodGroup] = useState<PeriodGroup>("day");
  const [tab, setTab] = useState<DetailTab>("order");
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const customError =
    preset === "custom" ? validateCustomPeriod(customFrom, customTo) : null;

  const range = useMemo(() => {
    if (preset === "custom") {
      if (customError) return null;
      return ymdToIsoRange(customFrom, customTo);
    }
    if (preset === "today") {
      const d = todayYmd();
      return ymdToIsoRange(d, d);
    }
    if (preset === "this_week") {
      const w = thisWeekYmd();
      return ymdToIsoRange(w.from, w.to);
    }
    const ymd = periodRangeYmd(preset);
    return ymdToIsoRange(ymd.from, ymd.to);
  }, [preset, customFrom, customTo, customError]);

  const queryPath = useMemo(() => {
    if (!range) return null;
    const q = new URLSearchParams({
      from: range.from,
      to: range.to,
      periodGroup,
    });
    if (sellerId) q.set("sellerId", sellerId);
    if (includeFixedCosts) q.set("includeFixedCosts", "1");
    return q.toString();
  }, [range, sellerId, includeFixedCosts, periodGroup]);

  const q = useQuery({
    queryKey: ["admin", "reports", "financial-result", queryPath],
    queryFn: () =>
      apiFetch<FinancialResult>(`/admin/reports/financial-result?${queryPath}`),
    enabled: canViewProfit && queryPath != null,
  });

  async function runPdf(kind: "download" | "print") {
    if (!queryPath) return;
    setExportErr(null);
    setExporting(true);
    try {
      const path = `/admin/reports/financial-result.pdf?${queryPath}`;
      if (kind === "print") await printPdf(path);
      else await downloadPdf(path, "resultado-financeiro.pdf");
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : "Falha ao gerar PDF");
    } finally {
      setExporting(false);
    }
  }

  const data = q.data;
  const t = data?.totals;
  const profitValue = includeFixedCosts ? t?.finalProfit : t?.profit;
  const marginValue = includeFixedCosts ? t?.finalMarginPct : t?.marginPct;

  if (!canViewProfit) {
    return (
      <ReportDataLayout title="Resultado financeiro">
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para visualizar lucro e margem nos relatórios.
        </p>
      </ReportDataLayout>
    );
  }

  return (
    <ReportDataLayout
      title="Resultado financeiro"
      description="Quanto vendeu, quanto custou, quanto pagou de comissão e quanto realmente sobrou no período."
      filters={
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Período</p>
              <div className="flex flex-wrap gap-2">
                {PERIOD_BUTTONS.map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition",
                      preset === btn.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                    onClick={() => {
                      if (btn.id === "custom" && preset !== "custom") {
                        const ymd =
                          preset === "today"
                            ? { from: todayYmd(), to: todayYmd() }
                            : preset === "this_week"
                              ? thisWeekYmd()
                              : periodRangeYmd(preset);
                        setCustomFrom(ymd.from);
                        setCustomTo(ymd.to);
                      }
                      setPreset(btn.id);
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
            <SellerFilterField
              value={sellerId}
              onChange={setSellerId}
              sellers={sellers}
            />
            <ReportField label="Agrupar período">
              <AppSelect
                value={periodGroup}
                onValueChange={(v) => setPeriodGroup(v as PeriodGroup)}
                options={[
                  { value: "day", label: "Dia" },
                  { value: "week", label: "Semana" },
                  { value: "month", label: "Mês" },
                ]}
              />
            </ReportField>
          </div>
          {preset === "custom" ? (
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker value={customFrom} onChange={setCustomFrom} placeholder="De" />
              <span className="text-xs text-muted-foreground">até</span>
              <DatePicker value={customTo} onChange={setCustomTo} placeholder="Até" />
              {customError ? (
                <p className="text-xs text-destructive">{customError}</p>
              ) : null}
            </div>
          ) : null}
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={includeFixedCosts}
              onCheckedChange={(v) => setIncludeFixedCosts(v === true)}
            />
            <span>
              <span className="font-medium">Considerar custos fixos</span>
              <span className="mt-0.5 block text-muted-foreground">
                Desconta as despesas fixas cadastradas, rateadas pelos dias do
                período selecionado. Impostos, fretes e taxas continuam de fora.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!queryPath || exporting}
              onClick={() => void runPdf("download")}
            >
              <FileDown className="size-4" />
              Exportar PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!queryPath || exporting}
              onClick={() => void runPdf("print")}
            >
              <Printer className="size-4" />
              Imprimir
            </Button>
            {exportErr ? (
              <p className="text-sm text-destructive">{exportErr}</p>
            ) : null}
          </div>
        </div>
      }
    >
      {customError ? (
        <p className="text-sm text-muted-foreground">
          Ajuste o período para carregar o relatório.
        </p>
      ) : q.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : q.isError ? (
        <p className="text-destructive">
          {q.error instanceof Error ? q.error.message : "Falha ao carregar"}
        </p>
      ) : data && t ? (
        <div className="space-y-6">
          {includeFixedCosts ? (
            <p className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              Resultado com custos fixos considerados no cálculo.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Pedidos" value={String(t.orderCount)} />
            <KpiCard label="Faturamento" value={fmtBrl(t.revenue)} />
            <KpiCard label="Ticket médio" value={fmtBrl(t.avgTicket)} />
            <KpiCard label="Custo dos produtos" value={fmtBrl(t.productCost)} />
            <KpiCard label="Comissões" value={fmtBrl(t.commission)} />
            <KpiCard
              label="Lucro"
              value={fmtBrl(t.profit)}
              negative={t.profit < 0}
              hint={t.profit < 0 ? "Prejuízo no período" : undefined}
            />
            <KpiCard
              label="Margem"
              value={fmtPct(t.marginPct)}
              negative={t.marginPct < 0}
            />
            {includeFixedCosts ? (
              <>
                <KpiCard
                  label="Custos fixos"
                  value={fmtBrl(t.fixedCosts)}
                  emphasize
                />
                <KpiCard
                  label="Lucro final"
                  value={fmtBrl(t.finalProfit)}
                  negative={t.finalProfit < 0}
                  emphasize
                  hint={
                    t.finalProfit < 0 ? "Prejuízo após custos fixos" : undefined
                  }
                />
                <KpiCard
                  label="Margem final"
                  value={fmtPct(t.finalMarginPct)}
                  negative={t.finalMarginPct < 0}
                  emphasize
                />
              </>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                Período atual
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtRange(data.period.from, data.period.to)}
              </p>
              <p className="mt-2 text-sm">
                Faturamento {fmtBrl(t.revenue)} · Lucro{" "}
                <span className={cn((profitValue ?? 0) < 0 && "text-destructive")}>
                  {fmtBrl(profitValue ?? 0)}
                </span>{" "}
                · Margem {fmtPct(marginValue ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                Período anterior equivalente
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtRange(data.previousPeriod.from, data.previousPeriod.to)}
              </p>
              <p className="mt-2 text-sm">
                Faturamento {fmtBrl(data.previous.revenue)} · Lucro{" "}
                {fmtBrl(
                  includeFixedCosts
                    ? data.previous.finalProfit
                    : data.previous.profit,
                )}{" "}
                · Margem{" "}
                {fmtPct(
                  includeFixedCosts
                    ? data.previous.finalMarginPct
                    : data.previous.marginPct,
                )}
              </p>
              <p className="mt-2 text-sm font-medium">
                Evolução do lucro:{" "}
                <span
                  className={cn(
                    (includeFixedCosts
                      ? data.evolution.finalProfitPct
                      : data.evolution.profitPct) != null &&
                      (includeFixedCosts
                        ? data.evolution.finalProfitPct
                        : data.evolution.profitPct)! < 0 &&
                      "text-destructive",
                  )}
                >
                  {evoLabel(
                    includeFixedCosts
                      ? data.evolution.finalProfitPct
                      : data.evolution.profitPct,
                  )}
                </span>
              </p>
            </div>
          </div>

          {t.linesMissingCost > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t.linesMissingCost} linha(s) sem custo cadastrado — entram com
              custo zero.
            </p>
          ) : null}

          <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="order">Por pedido</TabsTrigger>
              <TabsTrigger value="seller">Por vendedor</TabsTrigger>
              <TabsTrigger value="supplier">Por fornecedor</TabsTrigger>
              <TabsTrigger value="product">Por produto</TabsTrigger>
              <TabsTrigger value="period">Por período</TabsTrigger>
            </TabsList>
            <TabsContent value="order">
              <DetailTable
                kind="order"
                orders={data.byOrder}
                rows={[]}
              />
            </TabsContent>
            <TabsContent value="seller">
              <DetailTable kind="group" firstLabel="Vendedor" rows={data.bySeller} orders={[]} />
            </TabsContent>
            <TabsContent value="supplier">
              <DetailTable kind="group" firstLabel="Fornecedor" rows={data.bySupplier} orders={[]} />
            </TabsContent>
            <TabsContent value="product">
              <DetailTable kind="group" firstLabel="Produto" rows={data.byProduct} orders={[]} />
            </TabsContent>
            <TabsContent value="period">
              <DetailTable kind="group" firstLabel="Período" rows={data.byPeriod} orders={[]} />
            </TabsContent>
          </Tabs>

          <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            {data.criteria}
          </p>
        </div>
      ) : null}
    </ReportDataLayout>
  );
}

function DetailTable({
  kind,
  firstLabel,
  orders,
  rows,
}: {
  kind: "order" | "group";
  firstLabel?: string;
  orders: OrderRow[];
  rows: GroupRow[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {kind === "order" ? (
              <>
                <TableHead className="px-4">Pedido</TableHead>
                <TableHead className="px-4">Data</TableHead>
                <TableHead className="px-4">Cliente</TableHead>
              </>
            ) : (
              <>
                <TableHead className="px-4">{firstLabel}</TableHead>
                <TableHead className="px-4 text-right">Pedidos</TableHead>
              </>
            )}
            <TableHead className="px-4 text-right">Valor venda</TableHead>
            <TableHead className="px-4 text-right">Custo produtos</TableHead>
            <TableHead className="px-4 text-right">Comissão</TableHead>
            <TableHead className="px-4 text-right">Lucro</TableHead>
            <TableHead className="px-4 text-right">Margem %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {kind === "order"
            ? orders.map((row) => (
                <TableRow key={row.orderId}>
                  <TableCell className="px-4 py-2">{row.orderNumber}</TableCell>
                  <TableCell className="px-4 py-2">
                    {new Date(row.date).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="px-4 py-2">{row.customer}</TableCell>
                  <MoneyCell n={row.revenue} />
                  <MoneyCell n={row.productCost} />
                  <MoneyCell n={row.commission} />
                  <MoneyCell n={row.profit} />
                  <PctCell n={row.marginPct} />
                </TableRow>
              ))
            : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-4 py-2">{row.label}</TableCell>
                  <TableCell className="px-4 py-2 text-right tabular-nums">
                    {row.orderCount}
                  </TableCell>
                  <MoneyCell n={row.revenue} />
                  <MoneyCell n={row.productCost} />
                  <MoneyCell n={row.commission} />
                  <MoneyCell n={row.profit} />
                  <PctCell n={row.marginPct} />
                </TableRow>
              ))}
          {kind === "order" && orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-6 text-muted-foreground">
                Nenhum pedido no período.
              </TableCell>
            </TableRow>
          ) : null}
          {kind === "group" && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-6 text-muted-foreground">
                Sem dados no período.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
