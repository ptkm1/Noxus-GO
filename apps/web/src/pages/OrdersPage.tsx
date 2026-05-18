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
              ? "bg-brand-600 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Aguardando crédito
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Itens</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        o.status === "CONFIRMED"
                          ? "bg-green-100 text-green-800"
                          : o.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : o.status === "PENDING_CREDIT_APPROVAL"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{o.seller.user.name}</td>
                  <td className="px-4 py-3">{o.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{o.items.length}</td>
                  <td className="px-4 py-3 font-medium">R$ {Number(o.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/vendas/${o.id}`} className="text-brand-600 hover:underline">
                      Detalhe
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
