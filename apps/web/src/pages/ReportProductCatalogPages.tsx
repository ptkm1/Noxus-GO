import {
  fmtMoney,
  PeriodPresetBar,
  ReportDataLayout,
  ReportKpis,
  SellerFilterField,
  usePeriodState,
  useReportSellers,
} from "@/components/reports/ReportDataKit";
import { AppSelect } from "@/components/ui/app-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type TopProducts = {
  totals: {
    productCount: number;
    shown: number;
    totalAmount: number;
    totalQuantity: number;
  };
  rows: Array<{
    rank: number;
    productId: string;
    productName: string;
    sku: string | null;
    quantity: number;
    totalAmount: number;
    orderLines: number;
  }>;
};

type ProductPositivacao = {
  totals: {
    rowCount: number;
    customerCount: number;
    productCount: number;
    totalAmount: number;
  };
  rows: Array<{
    customerId: string;
    customerName: string;
    sellerName: string | null;
    productId: string;
    productName: string;
    sku: string | null;
    quantity: number;
    totalAmount: number;
  }>;
};

type Customer = { id: string; name: string };

export function ReportTopProductsPage() {
  const { preset, setPreset, range } = usePeriodState();
  const { data: sellers = [] } = useReportSellers();
  const [sellerId, setSellerId] = useState("");

  const q = useQuery({
    queryKey: [
      "admin",
      "reports",
      "top-products",
      range.from,
      range.to,
      sellerId,
    ],
    queryFn: () => {
      const p = new URLSearchParams({ from: range.from, to: range.to });
      if (sellerId) p.set("sellerId", sellerId);
      return apiFetch<TopProducts>(
        `/admin/reports/top-products?${p.toString()}`,
      );
    },
  });

  return (
    <ReportDataLayout
      title="Produtos mais vendidos"
      description="Ranking de produtos por faturamento e quantidade no período."
      filters={
        <>
          <PeriodPresetBar preset={preset} onPreset={setPreset} />
          <SellerFilterField
            value={sellerId}
            onChange={setSellerId}
            sellers={sellers}
          />
        </>
      }
    >
      {q.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : q.data ? (
        <div className="space-y-6">
          <ReportKpis
            items={[
              {
                label: "Produtos",
                value: String(q.data.totals.productCount),
              },
              {
                label: "Quantidade",
                value: String(q.data.totals.totalQuantity),
              },
              {
                label: "Faturamento (top)",
                value: `R$ ${fmtMoney(q.data.totals.totalAmount)}`,
              },
            ]}
          />
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">#</TableHead>
                  <TableHead className="px-4">Produto</TableHead>
                  <TableHead className="px-4">SKU</TableHead>
                  <TableHead className="px-4">Qtd</TableHead>
                  <TableHead className="px-4">Linhas</TableHead>
                  <TableHead className="px-4">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.rows.map((r) => (
                  <TableRow key={r.productId}>
                    <TableCell className="px-4 py-2">{r.rank}</TableCell>
                    <TableCell className="px-4 py-2">{r.productName}</TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      {r.sku ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2">{r.quantity}</TableCell>
                    <TableCell className="px-4 py-2">{r.orderLines}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      R$ {fmtMoney(r.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </ReportDataLayout>
  );
}

export function ReportProductPositivacaoPage() {
  const { preset, setPreset, range } = usePeriodState();
  const { data: sellers = [] } = useReportSellers();
  const { data: customers = [] } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => apiFetch<Customer[]>("/admin/customers"),
  });
  const [sellerId, setSellerId] = useState("");
  const [customerId, setCustomerId] = useState("");

  const q = useQuery({
    queryKey: [
      "admin",
      "reports",
      "product-positivacao",
      range.from,
      range.to,
      sellerId,
      customerId,
    ],
    queryFn: () => {
      const p = new URLSearchParams({ from: range.from, to: range.to });
      if (sellerId) p.set("sellerId", sellerId);
      if (customerId) p.set("customerId", customerId);
      return apiFetch<ProductPositivacao>(
        `/admin/reports/product-positivacao?${p.toString()}`,
      );
    },
  });

  return (
    <ReportDataLayout
      title="Positivação de produtos por cliente"
      description="Quais produtos cada cliente comprou no período (linhas cliente × produto)."
      filters={
        <>
          <PeriodPresetBar preset={preset} onPreset={setPreset} />
          <SellerFilterField
            value={sellerId}
            onChange={setSellerId}
            sellers={sellers}
          />
          <div className="min-w-[12rem]">
            <AppSelect
              value={customerId}
              onValueChange={setCustomerId}
              emptyLabel="Todos os clientes"
              options={customers.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
          </div>
        </>
      }
    >
      {q.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : q.data ? (
        <div className="space-y-6">
          <ReportKpis
            items={[
              {
                label: "Linhas",
                value: String(q.data.totals.rowCount),
              },
              {
                label: "Clientes",
                value: String(q.data.totals.customerCount),
              },
              {
                label: "Produtos",
                value: String(q.data.totals.productCount),
              },
              {
                label: "Total",
                value: `R$ ${fmtMoney(q.data.totals.totalAmount)}`,
              },
            ]}
          />
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Cliente</TableHead>
                  <TableHead className="px-4">Vendedor</TableHead>
                  <TableHead className="px-4">Produto</TableHead>
                  <TableHead className="px-4">SKU</TableHead>
                  <TableHead className="px-4">Qtd</TableHead>
                  <TableHead className="px-4">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.rows.map((r) => (
                  <TableRow key={`${r.customerId}:${r.productId}`}>
                    <TableCell className="px-4 py-2">{r.customerName}</TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      {r.sellerName ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2">{r.productName}</TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      {r.sku ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2">{r.quantity}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">
                      R$ {fmtMoney(r.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </ReportDataLayout>
  );
}
