import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { fmtCoord, googleMapsSearchUrl } from "../lib/maps-links";

type Seller = { id: string; user: { name: string } };

type CustomerVisitRow = {
  id: string;
  sellerId: string;
  sellerName: string;
  customerId: string;
  customerName: string;
  customerLatitude: number | null;
  customerLongitude: number | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
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

function LocationPoint({
  label,
  lat,
  lng,
  mapsLabel,
}: {
  label: string;
  lat: number | null;
  lng: number | null;
  mapsLabel: string;
}) {
  if (lat == null || lng == null) {
    return (
      <div className="text-slate-500">
        <span className="font-medium text-slate-600">{label}:</span> —
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-slate-600">{label}</span>
      <span className="font-mono text-xs text-slate-500">{fmtCoord(lat, lng)}</span>
      <a
        href={googleMapsSearchUrl(lat, lng, mapsLabel)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
      >
        Abrir no Maps
      </a>
    </div>
  );
}

function VisitLocationsCell({ v }: { v: CustomerVisitRow }) {
  const customerHasGps = v.customerLatitude != null && v.customerLongitude != null;

  return (
    <div className="flex min-w-[200px] flex-col gap-3 py-1">
      <LocationPoint
        label="Check-in (GPS)"
        lat={v.checkInLat}
        lng={v.checkInLng}
        mapsLabel={`${v.customerName} — check-in`}
      />
      <LocationPoint
        label="Check-out (GPS)"
        lat={v.checkOutLat}
        lng={v.checkOutLng}
        mapsLabel={`${v.customerName} — check-out`}
      />
      {customerHasGps ? (
        <div className="border-t border-slate-100 pt-2">
          <span className="text-xs text-slate-500">Cliente (cadastro)</span>
          <div className="mt-1 font-mono text-xs text-slate-500">
            {fmtCoord(v.customerLatitude!, v.customerLongitude!)}
          </div>
          <a
            href={googleMapsSearchUrl(
              v.customerLatitude!,
              v.customerLongitude!,
              v.customerName,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
          >
            Maps (endereço cadastrado)
          </a>
        </div>
      ) : null}
    </div>
  );
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
  const withCheckInGps = visits.filter((v) => v.checkInLat != null && v.checkInLng != null).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visitas em campo</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Check-in e check-out registados pelo app do vendedor, com coordenadas GPS quando o telemóvel as
          enviou. Use os links para abrir o ponto no Google Maps.
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
            Período: <strong className="text-slate-800">{fmtDateTime(visitsQ.data.period.from)}</strong>
            {" → "}
            <strong className="text-slate-800">{fmtDateTime(visitsQ.data.period.to)}</strong>
          </span>
          <span>
            Linhas: <strong className="text-slate-800">{visits.length}</strong>
            {visits.length >= visitsQ.data.limit ? (
              <span className="text-amber-700"> (limite {visitsQ.data.limit})</span>
            ) : null}
          </span>
          <span>
            Concluídas: <strong className="text-slate-800">{completed}</strong>
          </span>
          <span>
            Em aberto: <strong className="text-slate-800">{open}</strong>
          </span>
          <span>
            Com GPS no check-in: <strong className="text-slate-800">{withCheckInGps}</strong>
          </span>
        </div>
      ) : null}

      {visitsQ.isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Saída</th>
                <th className="px-4 py-3">Tempo</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Localização</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Notas</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                    Nenhuma visita neste período.
                  </td>
                </tr>
              ) : (
                visits.map((v) => (
                  <tr key={v.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-3">{fmtDateTime(v.checkedInAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {v.checkedOutAt ? fmtDateTime(v.checkedOutAt) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{fmtDuration(v.durationSeconds, v.openVisit)}</td>
                    <td className="px-4 py-3">{v.sellerName}</td>
                    <td className="px-4 py-3">{v.customerName}</td>
                    <td className="px-4 py-3">
                      <VisitLocationsCell v={v} />
                    </td>
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
                    <td className="max-w-[240px] px-4 py-3 text-slate-600" title={v.notes ?? undefined}>
                      <span className="line-clamp-3">{v.notes?.trim() ? v.notes : "—"}</span>
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