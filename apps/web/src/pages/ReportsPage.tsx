import { useAuth } from "@/auth/AuthContext";
import { ManagementReportsPanel } from "@/components/ManagementReportsPanel";
import { AppSelect } from "@/components/ui/app-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isWebAdmin, isWebTeamLeader } from "@/lib/staff";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, downloadPdf } from "../lib/api";

type Seller = { id: string; user: { name: string } };

type TeamSalesSummary = {
  generatedAt: string;
  teamName: string | null;
  period: { from: string | null; to: string | null };
  totals: { orderCount: number; totalAmount: number };
  bySeller: Array<{
    sellerId: string;
    name: string;
    orderCount: number;
    totalAmount: number;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    totalAmount: number;
  }>;
};

function fmtMoney(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export function ReportsPage() {
  const { user } = useAuth();
  const teamLeader = isWebTeamLeader(user);
  const admin = isWebAdmin(user?.role);

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
    enabled: !teamLeader,
  });

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const teamSummaryQ = useQuery({
    queryKey: ["admin", "team-summary", from, to],
    queryFn: () => {
      const q = new URLSearchParams();
      if (from) q.set("from", new Date(from).toISOString());
      if (to) q.set("to", new Date(to).toISOString());
      const suffix = q.toString() ? `?${q.toString()}` : "";
      return apiFetch<TeamSalesSummary>(`/admin/reports/team-summary${suffix}`);
    },
    enabled: teamLeader,
    staleTime: 45_000,
  });

  async function exportPdf() {
    setErr(null);
    setPending(true);
    try {
      const q = new URLSearchParams();
      if (from) q.set("from", new Date(from).toISOString());
      if (to) q.set("to", new Date(to).toISOString());
      if (sellerId) q.set("sellerId", sellerId);
      await downloadPdf(
        `/admin/reports/sales.pdf?${q.toString()}`,
        "relatorio-vendas.pdf",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao exportar");
    } finally {
      setPending(false);
    }
  }

  const teamSummary = teamSummaryQ.data;

  if (teamLeader) {
    return (
      <div className="space-y-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Relatórios da equipe
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Scorecard, visitas e resumo de vendas confirmadas da sua equipe
            {user?.teamName ? ` (${user.teamName})` : ""}.
          </p>
        </div>

        <ManagementReportsPanel showAdminOnly={false} />

        <div className="border-t border-border pt-8">
          <h2 className="text-xl font-semibold">Resumo detalhado da equipe</h2>
        </div>

        <div className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <label className="block text-sm font-medium text-foreground">
              De
            </label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Até
            </label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
            disabled={teamSummaryQ.isFetching}
            onClick={() => void teamSummaryQ.refetch()}
          >
            {teamSummaryQ.isFetching ? "Atualizando…" : "Atualizar resumo"}
          </button>
        </div>

        {teamSummaryQ.isLoading ? (
          <p className="text-muted-foreground">Montando resumo…</p>
        ) : teamSummaryQ.error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
            {(teamSummaryQ.error as Error).message}
          </p>
        ) : teamSummary ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  Pedidos confirmados
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {teamSummary.totals.orderCount}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Faturamento</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  R$ {fmtMoney(teamSummary.totals.totalAmount)}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card">
              <p className="border-b border-border px-4 py-3 text-sm font-medium">
                Por vendedor
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Vendedor</TableHead>
                    <TableHead className="px-4">Pedidos</TableHead>
                    <TableHead className="px-4">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamSummary.bySeller.map((s) => (
                    <TableRow key={s.sellerId}>
                      <TableCell className="px-4 py-3">{s.name}</TableCell>
                      <TableCell className="px-4 py-3">
                        {s.orderCount}
                      </TableCell>
                      <TableCell className="px-4 py-3 tabular-nums">
                        R$ {fmtMoney(s.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {teamSummary.topProducts.length > 0 ? (
              <div className="rounded-xl border border-border bg-card">
                <p className="border-b border-border px-4 py-3 text-sm font-medium">
                  Top produtos
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Produto</TableHead>
                      <TableHead className="px-4">Qtd</TableHead>
                      <TableHead className="px-4">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamSummary.topProducts.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="px-4 py-3">
                          {p.productName}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {p.quantity}
                        </TableCell>
                        <TableCell className="px-4 py-3 tabular-nums">
                          R$ {fmtMoney(p.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Relatórios gerenciais de vendas, margem, comissão, estoque, crédito,
          fiscal e visitas. Para indicadores do dia a dia, use{" "}
          <Link
            to="/indicadores"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Indicadores
          </Link>
          .
        </p>
      </div>

      <ManagementReportsPanel showAdminOnly={admin || !teamLeader} />

      <section className="space-y-4 border-t border-border pt-10">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Exportar vendas em PDF
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Opcional — escolha período e vendedor só quando precisar do arquivo.
          </p>
        </div>

        <div className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <label className="block text-sm font-medium text-foreground">
              De
            </label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Até
            </label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Vendedor
            </label>
            <AppSelect
              className="mt-1"
              value={sellerId}
              emptyLabel="Todos"
              placeholder="Todos"
              options={sellers.map((s) => ({
                value: s.id,
                label: s.user.name,
              }))}
              onValueChange={setSellerId}
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            onClick={() => void exportPdf()}
            disabled={pending}
          >
            {pending ? "Gerando…" : "Exportar PDF"}
          </button>
        </div>
      </section>
    </div>
  );
}
