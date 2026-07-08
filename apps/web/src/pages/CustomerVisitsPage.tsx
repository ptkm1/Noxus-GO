import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FilterBar, FormField } from "@/components/forms";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div className="text-muted-foreground">
        <span className="font-medium text-muted-foreground">{label}:</span> —
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-muted-foreground">{fmtCoord(lat, lng)}</span>
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
        <div className="border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">Cliente (cadastro)</span>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
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
        <h1 className="text-2xl font-semibold text-foreground">Visitas em campo</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Check-in e check-out registados pelo app do vendedor, com coordenadas GPS quando o telemóvel as
          enviou. Use os links para abrir o ponto no Google Maps.
        </p>
      </div>

      <FilterBar className="p-4">
        <FormField label="De" htmlFor="visits-from">
          <Input
            id="visits-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </FormField>
        <FormField label="Até" htmlFor="visits-to">
          <Input id="visits-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </FormField>
        <FormField label="Vendedor" htmlFor="visits-seller">
          <AppSelect
            id="visits-seller"
            value={sellerId}
            emptyLabel="Todos"
            placeholder="Todos"
            options={sellers.map((s) => ({
              value: s.id,
              label: s.user.name,
            }))}
            onValueChange={setSellerId}
          />
        </FormField>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={visitsQ.isFetching}
            onClick={() => void visitsQ.refetch()}
          >
            {visitsQ.isFetching ? "Carregando…" : "Atualizar"}
          </Button>
        </div>
      </FilterBar>

      {visitsQ.isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar as visitas. Verifique as datas ou tente novamente.
        </p>
      ) : null}

      {visitsQ.data ? (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>
            Período: <strong className="text-foreground">{fmtDateTime(visitsQ.data.period.from)}</strong>
            {" → "}
            <strong className="text-foreground">{fmtDateTime(visitsQ.data.period.to)}</strong>
          </span>
          <span>
            Linhas: <strong className="text-foreground">{visits.length}</strong>
            {visits.length >= visitsQ.data.limit ? (
              <span className="text-amber-700"> (limite {visitsQ.data.limit})</span>
            ) : null}
          </span>
          <span>
            Concluídas: <strong className="text-foreground">{completed}</strong>
          </span>
          <span>
            Em aberto: <strong className="text-foreground">{open}</strong>
          </span>
          <span>
            Com GPS no check-in: <strong className="text-foreground">{withCheckInGps}</strong>
          </span>
        </div>
      ) : null}

      {visitsQ.isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-background text-left text-muted-foreground">
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
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                    Nenhuma visita neste período.
                  </td>
                </tr>
              ) : (
                visits.map((v) => (
                  <tr key={v.id} className="border-t border-border align-top">
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
                        <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                          Em aberto
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
                          Concluída
                        </span>
                      )}
                    </td>
                    <td className="max-w-[240px] px-4 py-3 text-muted-foreground" title={v.notes ?? undefined}>
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