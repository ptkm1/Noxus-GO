import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FISCAL_INVOICE_STATUS_LABELS, orderStatusLabel } from "@pedidos/shared";
import type { FiscalInvoiceStatus } from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Order = {
  id: string;
  status: string;
  totalAmount: unknown;
  createdAt: string;
  seller: { user: { name: string } };
  customer: { name: string } | null;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: unknown;
  }[];
  fiscalInvoices?: {
    id: string;
    status: FiscalInvoiceStatus;
    number: number | null;
    series: number | null;
  }[];
};

export function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "orders", statusFilter ?? "all"],
    queryFn: () => {
      const q =
        statusFilter && statusFilter !== ""
          ? `?status=${encodeURIComponent(statusFilter)}`
          : "";
      return apiFetch<Order[]>(`/admin/orders${q}`);
    },
  });

  function setFilter(next: string | null) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next) p.set("status", next);
      else p.delete("status");
      return p;
    });
  }

  const pendingCreditSelected = statusFilter === "PENDING_CREDIT_APPROVAL";

  function fiscalBadge(order: Order) {
    const inv = order.fiscalInvoices?.[0];
    if (!inv) {
      return order.status === "CONFIRMED" ? (
        <span className="rounded px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
          Sem NF-e
        </span>
      ) : (
        "—"
      );
    }
    const color =
      inv.status === "AUTHORIZED"
        ? "bg-green-100 text-green-800"
        : inv.status === "REJECTED" || inv.status === "CANCELLED"
          ? "bg-red-100 text-red-800"
          : inv.status === "DRAFT"
            ? "bg-amber-100 text-amber-800"
            : "bg-muted text-foreground";
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>
        {FISCAL_INVOICE_STATUS_LABELS[inv.status]}
        {inv.number != null ? ` ${inv.series}/${inv.number}` : ""}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Vendas</h1>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            !pendingCreditSelected
              ? "bg-primary text-white"
              : "border border-border bg-card text-foreground hover:bg-background"
          }`}
        >
          Todas
        </button>
        <button
          type="button"
          onClick={() => setFilter("PENDING_CREDIT_APPROVAL")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            pendingCreditSelected
              ? "bg-amber-600 text-white"
              : "border border-border bg-card text-foreground hover:bg-background"
          }`}
        >
          Aguardando crédito
        </button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Data</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4">NF-e</TableHead>
                <TableHead className="px-4">Vendedor</TableHead>
                <TableHead className="px-4">Cliente</TableHead>
                <TableHead className="px-4">Itens</TableHead>
                <TableHead className="px-4">Total</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        o.status === "CONFIRMED"
                          ? "bg-green-100 text-green-800"
                          : o.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : o.status === "PENDING_CREDIT_APPROVAL"
                              ? "bg-amber-100 text-warning"
                              : "bg-muted text-foreground"
                      }`}
                    >
                      {orderStatusLabel(o.status)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">{fiscalBadge(o)}</TableCell>
                  <TableCell className="px-4 py-3">{o.seller.user.name}</TableCell>
                  <TableCell className="px-4 py-3">{o.customer?.name ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {o.items.length}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium">
                    R$ {Number(o.totalAmount).toFixed(2)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Link
                      to={`/vendas/${o.id}`}
                      className="text-primary hover:underline"
                    >
                      Detalhe
                    </Link>
                    {o.status === "CONFIRMED" ? (
                      <>
                        {" · "}
                        <Link
                          to="/faturamento"
                          className="text-primary hover:underline"
                        >
                          Faturar
                        </Link>
                      </>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
