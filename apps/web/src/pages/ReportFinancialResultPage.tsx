import { useAuth } from "@/auth/AuthContext";
import {
  fmtDateTime,
  fmtMoney,
  fmtPct,
  PeriodPresetBar,
  ReportDataLayout,
  ReportKpis,
  SellerFilterField,
  usePeriodState,
  useReportSellers,
} from "@/components/reports/ReportDataKit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch, downloadPdf } from "@/lib/api";
import { cn } from "@/lib/utils";
import { canRead } from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type DetailGroup = "order" | "seller" | "supplier" | "product";

type FinancialResult = {
  includeFixedCosts: boolean;
  criteriaFooter: string;
  totals: {
    orderCount: number;
    revenue: number;
    avgTicket: number;
    productCost: number;
    commission: number;
    grossProfit: number;
    grossMarginPct: number;
    fixedCosts?: number;
    finalProfit?: number;
    finalMarginPct?: number;
    linesMissingCost: number;
  };
  byOrder: Array<{
    orderId: string;
    orderCode: string;
    createdAt: string;
    customerName: string;
    sellerName: string;
    revenue: number;
    productCost: number;
    commission: number;
    profit: number;
    marginPct: number;
  }>;
  bySeller: GroupRow[];
  bySupplier: GroupRow[];
  byProduct: GroupRow[];
};

type GroupRow = {
  id: string;
  label: string;
  orderCount: number;
  quantity: number;
  revenue: number;
  productCost: number;
  commission: number;
  profit: number;
  marginPct: number;
};

function moneyCell(value: number, negativeIsBad = false) {
  return (
    <span
      className={cn(
        "tabular-nums",
        negativeIsBad && value < 0 && "font-medium text-destructive",
      )}
    >
      R$ {fmtMoney(value)}
    </span>
  );
}

function pctCell(value: number) {
  return (
    <span
      className={cn(
        "tabular-nums",
        value < 0 && "font-medium text-destructive",
      )}
    >
      {fmtPct(value)}
    </span>
  );
}

export function ReportFinancialResultPage() {
  const { user } = useAuth();
  const canViewProfit = Boolean(
    user && canRead(user.role, "reports_profit_percent", user.permissions),
  );
  const { preset, setPreset, range } = usePeriodState();
  const { data: sellers = [] } = useReportSellers();
  const [sellerId, setSellerId] = useState("");
  const [includeFixedCosts, setIncludeFixedCosts] = useState(false);
  const [group, setGroup] = useState<DetailGroup>("order");
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: [
      "admin",
      "reports",
      "financial-result",
      range.from,
      range.to,
      sellerId,
      includeFixedCosts,
    ],
    enabled: canViewProfit,
    queryFn: () => {
      const p = new URLSearchParams({ from: range.from, to: range.to });
      if (sellerId) p.set("sellerId", sellerId);
      if (includeFixedCosts) p.set("includeFixedCosts", "1");
      return apiFetch<FinancialResult>(
        `/admin/reports/financial-result?${p.toString()}`,
      );
    },
  });

  async function exportPdf() {
    setPdfErr(null);
    setPdfPending(true);
    try {
      const p = new URLSearchParams({ from: range.from, to: range.to });
      if (sellerId) p.set("sellerId", sellerId);
      if (includeFixedCosts) p.set("includeFixedCosts", "1");
      await downloadPdf(
        `/admin/reports/financial-result.pdf?${p.toString()}`,
        "resultado-financeiro.pdf",
      );
    } catch (e) {
      setPdfErr(e instanceof Error ? e.message : "Falha ao gerar PDF");
    } finally {
      setPdfPending(false);
    }
  }

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
      description="Faturamento, custos de produtos, comissões e lucro das vendas confirmadas no período."
      filters={
        <>
          <PeriodPresetBar preset={preset} onPreset={setPreset} />
          <SellerFilterField
            value={sellerId}
            onChange={setSellerId}
            sellers={sellers}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={includeFixedCosts}
              onCheckedChange={(v) => setIncludeFixedCosts(v === true)}
            />
            Considerar custos fixos
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pdfPending || q.isLoading}
            onClick={() => void exportPdf()}
          >
            {pdfPending ? "Gerando PDF…" : "Exportar PDF"}
          </Button>
        </>
      }
    >
      {q.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : q.isError ? (
        <p className="text-destructive">
          {q.error instanceof Error ? q.error.message : "Falha ao carregar"}
        </p>
      ) : q.data ? (
        <div className="space-y-6">
          <ReportKpis
            items={[
              {
                label: "Pedidos emitidos",
                value: String(q.data.totals.orderCount),
              },
              {
                label: "Faturamento total",
                value: `R$ ${fmtMoney(q.data.totals.revenue)}`,
              },
              {
                label: "Ticket médio",
                value: `R$ ${fmtMoney(q.data.totals.avgTicket)}`,
              },
              {
                label: "Custo produtos vendidos",
                value: `R$ ${fmtMoney(q.data.totals.productCost)}`,
                hint:
                  q.data.totals.linesMissingCost > 0
                    ? `${q.data.totals.linesMissingCost} linhas sem costPrice`
                    : undefined,
              },
              {
                label: "Comissões totais",
                value: `R$ ${fmtMoney(q.data.totals.commission)}`,
              },
              {
                label: includeFixedCosts ? "Lucro bruto" : "Lucro bruto R$",
                value: `R$ ${fmtMoney(q.data.totals.grossProfit)}`,
                negative: q.data.totals.grossProfit < 0,
              },
              {
                label: includeFixedCosts ? "Margem bruta %" : "Margem lucro %",
                value: fmtPct(q.data.totals.grossMarginPct),
                negative: q.data.totals.grossMarginPct < 0,
                hint:
                  !includeFixedCosts && q.data.totals.grossProfit < 0
                    ? "Prejuízo no período"
                    : undefined,
              },
              ...(includeFixedCosts && q.data.totals.fixedCosts != null
                ? [
                    {
                      label: "Custos fixos",
                      value: `R$ ${fmtMoney(q.data.totals.fixedCosts)}`,
                    },
                    {
                      label: "Lucro final",
                      value: `R$ ${fmtMoney(q.data.totals.finalProfit ?? 0)}`,
                      negative: (q.data.totals.finalProfit ?? 0) < 0,
                    },
                    {
                      label: "Margem final %",
                      value: fmtPct(q.data.totals.finalMarginPct ?? 0),
                      negative: (q.data.totals.finalMarginPct ?? 0) < 0,
                      hint:
                        (q.data.totals.finalProfit ?? 0) < 0
                          ? "Prejuízo após custos fixos"
                          : undefined,
                    },
                  ]
                : []),
            ]}
          />

          <div className="space-y-3">
            <Tabs
              value={group}
              onValueChange={(v) => {
                if (
                  v === "seller" ||
                  v === "supplier" ||
                  v === "product" ||
                  v === "order"
                ) {
                  setGroup(v);
                }
              }}
            >
              <TabsList aria-label="Detalhamento">
                <TabsTrigger value="order">Por pedido</TabsTrigger>
                <TabsTrigger value="seller">Vendedor</TabsTrigger>
                <TabsTrigger value="supplier">Fornecedor</TabsTrigger>
                <TabsTrigger value="product">Produto</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              {group === "order" ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Pedido</TableHead>
                      <TableHead className="px-4">Data</TableHead>
                      <TableHead className="px-4">Cliente</TableHead>
                      <TableHead className="px-4">Vendedor</TableHead>
                      <TableHead className="px-4">Valor venda</TableHead>
                      <TableHead className="px-4">Custo produtos</TableHead>
                      <TableHead className="px-4">Comissão</TableHead>
                      <TableHead className="px-4">Lucro</TableHead>
                      <TableHead className="px-4">Margem %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.data.byOrder.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="px-4 py-6 text-center text-muted-foreground"
                        >
                          Nenhuma venda no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      q.data.byOrder.map((r) => (
                        <TableRow key={r.orderId}>
                          <TableCell className="px-4 py-2 tabular-nums">
                            {r.orderCode}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-sm text-muted-foreground">
                            {fmtDateTime(r.createdAt)}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {r.customerName}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {r.sellerName}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {moneyCell(r.revenue)}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {moneyCell(r.productCost)}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {moneyCell(r.commission)}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {moneyCell(r.profit, true)}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            {pctCell(r.marginPct)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                <GroupedTable
                  rows={
                    group === "seller"
                      ? q.data.bySeller
                      : group === "supplier"
                        ? q.data.bySupplier
                        : q.data.byProduct
                  }
                  showQuantity={group === "product"}
                />
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{q.data.criteriaFooter}</p>
          {pdfErr ? (
            <p className="text-sm text-destructive">{pdfErr}</p>
          ) : null}
        </div>
      ) : null}
    </ReportDataLayout>
  );
}

function GroupedTable(props: {
  rows: GroupRow[];
  showQuantity: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-4">Nome</TableHead>
          {props.showQuantity ? (
            <TableHead className="px-4">Qtd.</TableHead>
          ) : null}
          <TableHead className="px-4">Pedidos</TableHead>
          <TableHead className="px-4">Valor venda</TableHead>
          <TableHead className="px-4">Custo</TableHead>
          <TableHead className="px-4">Comissão</TableHead>
          <TableHead className="px-4">Lucro</TableHead>
          <TableHead className="px-4">Margem %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={props.showQuantity ? 8 : 7}
              className="px-4 py-6 text-center text-muted-foreground"
            >
              Nenhuma venda no período.
            </TableCell>
          </TableRow>
        ) : (
          props.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="px-4 py-2">{r.label}</TableCell>
              {props.showQuantity ? (
                <TableCell className="px-4 py-2 tabular-nums">
                  {r.quantity}
                </TableCell>
              ) : null}
              <TableCell className="px-4 py-2">{r.orderCount}</TableCell>
              <TableCell className="px-4 py-2">{moneyCell(r.revenue)}</TableCell>
              <TableCell className="px-4 py-2">
                {moneyCell(r.productCost)}
              </TableCell>
              <TableCell className="px-4 py-2">
                {moneyCell(r.commission)}
              </TableCell>
              <TableCell className="px-4 py-2">
                {moneyCell(r.profit, true)}
              </TableCell>
              <TableCell className="px-4 py-2">{pctCell(r.marginPct)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
