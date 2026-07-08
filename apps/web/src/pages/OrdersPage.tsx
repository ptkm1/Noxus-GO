import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  items: { id: string; productName: string; quantity: number; unitPrice: unknown }[];
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
                      {o.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">{o.seller.user.name}</TableCell>
                  <TableCell className="px-4 py-3">{o.customer?.name ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">{o.items.length}</TableCell>
                  <TableCell className="px-4 py-3 font-medium">R$ {Number(o.totalAmount).toFixed(2)}</TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Link to={`/vendas/${o.id}`} className="text-primary hover:underline">
                      Detalhe
                    </Link>
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
