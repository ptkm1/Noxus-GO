import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type Seller = { id: string; user: { name: string } };

type CustomerVisitRow = {
  id: string;
  sellerId: string;
  sellerName: string;
  customerId: string;
  customerName: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  durationSeconds: number | null;
  openVisit: boolean;
  notes: string | null;
};

type CustomerVisitsPayload = {
  period: { from: string; to: string };
  limit: number;
  visits: CustomerVisitRow[];
};

function isoDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtDuration(seconds: number | null, openVisit: boolean): string {
  if (openVisit && seconds === null) return "Em aberto";
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${mm.toString().padStart(2, "0")}min`;
}

export function CustomerVisitsPage() {
  const defaultRange = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { fromStr: isoDateUTC(from), toStr: isoDateUTC(to) };
  }, []);

  const [from, setFrom] = useState(defaultRange.fromStr);
  const [to, setTo] = useState(defaultRange.toStr);
  const [sellerId, setSellerId] = useState("");

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const visitsQ = useQuery({
    queryKey: ["admin", "customer-visits", from, to, sellerId],
    queryFn: async () => {
      const q = new URLSearchParams();
      q.set("from", from);
      q.set("to", to);
      if (sellerId.trim()) q.set("sellerId", sellerId.trim());
      return apiFetch<CustomerVisitsPayload>(`/admin/customer-visits?${q.toString()}`);
    },
    enabled: Boolean(from.trim() && to.trim()),
    staleTime: 30_000,
  });

  const visits = visitsQ.data?.visits ?? [];
  const completed = visits.filter((v) => !v.openVisit).length;
  const open = visits.filter((v) => v.openVisit).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visitas em campo</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Check-in e check-out registados pelo app do vendedor. Use o período e o vendedor para filtrar; os horários são
          gravados em UTC no servidor e mostrados no seu fuso neste navegador.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">De</span>
          <input
            type="date"
            className="rounded border border-slate-200 px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Até</span>
          <input
            type="date"
            className="rounded border border-slate-200 px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="flex min-w-[200px] flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Vendedor</span>
          <select
            className="rounded border border-slate-200 px-3 py-2 text-sm"
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
          >
            <option value="">Todos</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.user.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={visitsQ.isFetching}
          onClick={() => void visitsQ.refetch()}
        >
          {visitsQ.isFetching ? "Carregando…" : "Atualizar"}
        </button>
      </div>

      {visitsQ.isError ? (
        <p className="text-sm text-red-700">
          Não foi possível carregar as visitas. Verifique as datas ou tente novamente.
        </p>
      ) : null}

      {visitsQ.data ? (
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <span>
            Período aplicado (servidor):{" "}
            <strong className="text-slate-800">{fmtDateTime(visitsQ.data.period.from)}</strong>
            {" → "}
            <strong className="text-slate-800">{fmtDateTime(visitsQ.data.period.to)}</strong>
          </span>
          <span>
            Linhas: <strong className="text-slate-800">{visits.length}</strong>
            {visits.length >= visitsQ.data.limit ? (
              <span className="text-amber-700"> (limite {visitsQ.data.limit}; reduza o período se precisar de mais)</span>
            ) : null}
          </span>
          <span>
            Concluídas: <strong className="text-slate-800">{completed}</strong>
          </span>
          <span>
            Em aberto na lista: <strong className="text-slate-800">{open}</strong>
          </span>
        </div>
      ) : null}

      {visitsQ.isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Saída</th>
                <th className="px-4 py-3">Tempo</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Notas</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                    Nenhuma visita neste período.
                  </td>
                </tr>
              ) : (
                visits.map((v) => (
                  <tr key={v.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-3">{fmtDateTime(v.checkedInAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {v.checkedOutAt ? fmtDateTime(v.checkedOutAt) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{fmtDuration(v.durationSeconds, v.openVisit)}</td>
                    <td className="px-4 py-3">{v.sellerName}</td>
                    <td className="px-4 py-3">{v.customerName}</td>
                    <td className="px-4 py-3">
                      {v.openVisit ? (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                          Em aberto
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
                          Concluída
                        </span>
                      )}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-slate-600" title={v.notes ?? undefined}>
                      {v.notes?.trim() ? v.notes : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
