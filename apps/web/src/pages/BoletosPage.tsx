import {
  BoletoHistorySheet,
  CancelBoletoSheet,
} from "../components/boletos/BoletoActionSheets";
import { EditBoletoSheet } from "../components/boletos/EditBoletoSheet";
import {
  EmitBoletoSheet,
  openBoletoPdfs,
} from "../components/boletos/EmitBoletoSheet";
import {
  BOLETO_STATUS_LABEL,
  type BoletoDetail,
  type BoletoRow,
  type BoletosSummary,
  type EligibleOrder,
  type ReceivableStatus,
} from "../components/boletos/types";
import { AppSelect } from "../components/ui/app-select";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { apiFetch, fetchAuthenticatedBlob, openPdfBlob } from "../lib/api";
import { getErrorMessage } from "../lib/api-error";
import {
  confirmAction,
  notifyError,
  notifySuccess,
} from "../lib/app-notifications";
import { formatOrderCode } from "../lib/order-code";
import { cn } from "../lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

function fmtBrl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

type Tab = "boletos" | "elegiveis";

export function BoletosPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("boletos");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [emitOrder, setEmitOrder] = useState<EligibleOrder | null>(null);
  const [editBoleto, setEditBoleto] = useState<BoletoDetail | null>(null);
  const [cancelBoleto, setCancelBoleto] = useState<BoletoRow | null>(null);
  const [historyDetail, setHistoryDetail] = useState<BoletoDetail | null>(null);

  const summaryQ = useQuery({
    queryKey: ["admin", "boletos", "summary"],
    queryFn: () => apiFetch<BoletosSummary>("/admin/boletos/summary"),
  });

  const boletosQ = useQuery({
    queryKey: ["admin", "boletos", statusFilter, search],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set("status", statusFilter);
      if (search.trim()) qs.set("q", search.trim());
      const q = qs.toString();
      return apiFetch<BoletoRow[]>(`/admin/boletos${q ? `?${q}` : ""}`);
    },
    enabled: tab === "boletos",
  });

  const eligibleQ = useQuery({
    queryKey: ["admin", "boletos", "eligible-orders"],
    queryFn: () =>
      apiFetch<EligibleOrder[]>("/admin/boletos/eligible-orders"),
    enabled: tab === "elegiveis",
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "boletos"] });
  };

  const emitAll = useMutation({
    mutationFn: () =>
      apiFetch<{
        openPdfIds: string[];
        results: Array<{ orderId: string; ok: boolean; error?: string }>;
      }>("/admin/boletos/emit-all", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: async (res) => {
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.length - ok;
      notifySuccess(
        fail
          ? `${ok} pedido(s) ok, ${fail} com erro`
          : `${ok} pedido(s) emitidos`,
      );
      invalidate();
      if (res.openPdfIds?.length) await openBoletoPdfs(res.openPdfIds);
    },
    onError: (e) => notifyError(getErrorMessage(e)),
  });

  const syncOne = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/boletos/${id}/sync`, { method: "POST" }),
    onSuccess: () => {
      notifySuccess("Sincronizado");
      invalidate();
    },
    onError: (e) => notifyError(getErrorMessage(e)),
  });

  const reissue = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ openPdfIds: string[] }>(`/admin/boletos/${id}/reissue`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: async (res) => {
      notifySuccess("Boleto reemitido");
      invalidate();
      if (res.openPdfIds?.length) await openBoletoPdfs(res.openPdfIds);
    },
    onError: (e) => notifyError(getErrorMessage(e)),
  });

  async function openPdf(id: string) {
    try {
      const blob = await fetchAuthenticatedBlob(`/admin/boletos/${id}/pdf`);
      const url = openPdfBlob(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      notifyError(getErrorMessage(e));
    }
  }

  async function loadDetail(id: string): Promise<BoletoDetail | null> {
    try {
      return await apiFetch<BoletoDetail>(`/admin/boletos/${id}`);
    } catch (e) {
      notifyError(getErrorMessage(e));
      return null;
    }
  }

  const summary = summaryQ.data;
  const cards = useMemo(
    () => [
      {
        label: "Em aberto",
        value: summary?.open ?? "—",
        hint: summary ? fmtBrl(summary.totalOpenAmount) : undefined,
      },
      { label: "Vencidos", value: summary?.overdue ?? "—" },
      { label: "Vencem em 7 dias", value: summary?.dueSoon ?? "—" },
      { label: "Pagos no mês", value: summary?.paidMonth ?? "—" },
      { label: "Processando", value: summary?.processing ?? "—" },
      { label: "Com erro", value: summary?.errors ?? "—" },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Emissão de boletos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Emita boletos de pedidos confirmados a prazo. Configure o banco em{" "}
            <Link
              to="/financeiro/integracoes-bancarias"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Integrações bancárias
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setTab("elegiveis")}
          >
            Pedidos elegíveis
          </Button>
          <Button
            type="button"
            disabled={emitAll.isPending}
            onClick={() => {
              void confirmAction({
                title: "Emitir todos?",
                message:
                  "Emite as parcelas pendentes de todos os pedidos elegíveis.",
                confirmLabel: "Emitir todos",
              }).then((ok) => {
                if (ok) emitAll.mutate();
              });
            }}
          >
            {emitAll.isPending ? "Emitindo…" : "Emitir todos"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {c.value}
            </p>
            {c.hint ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-border">
        {(
          [
            ["boletos", "Boletos"],
            ["elegiveis", "Elegíveis"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "boletos" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              className="max-w-xs"
              placeholder="Buscar cliente, linha, nosso nº…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <AppSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              emptyLabel="Todos os status"
              options={(
                Object.keys(BOLETO_STATUS_LABEL) as ReceivableStatus[]
              ).map((s) => ({
                value: s,
                label: BOLETO_STATUS_LABEL[s],
              }))}
              className="w-48"
            />
          </div>

          {boletosQ.isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : !boletosQ.data?.length ? (
            <p className="text-muted-foreground">Nenhum boleto encontrado.</p>
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Cliente</TableHead>
                    <TableHead className="px-4">Pedido</TableHead>
                    <TableHead className="px-4">Parcela</TableHead>
                    <TableHead className="px-4">Vencimento</TableHead>
                    <TableHead className="px-4">Valor</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                    <TableHead className="px-4">Banco</TableHead>
                    <TableHead className="px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boletosQ.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="px-4 py-3">
                        {row.customerName ?? "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-xs">
                        {row.orderId
                          ? formatOrderCode({
                              id: row.orderId,
                              orderNumber: row.orderNumber,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {row.installmentIndex != null &&
                        row.installmentTotal != null
                          ? `${row.installmentIndex}/${row.installmentTotal}`
                          : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {fmtDate(row.dueDate)}
                      </TableCell>
                      <TableCell className="px-4 py-3 tabular-nums">
                        {fmtBrl(row.amount)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {BOLETO_STATUS_LABEL[row.status] ?? row.status}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {row.provider ?? "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="text-sm font-medium text-primary"
                          onClick={() => void openPdf(row.id)}
                        >
                          2ª via
                        </button>
                        <button
                          type="button"
                          className="ml-3 text-sm text-muted-foreground hover:text-foreground"
                          onClick={() => syncOne.mutate(row.id)}
                        >
                          Sync
                        </button>
                        <button
                          type="button"
                          className="ml-3 text-sm text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            void loadDetail(row.id).then((d) => {
                              if (d) {
                                setEditBoleto(d);
                              }
                            });
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="ml-3 text-sm text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            void loadDetail(row.id).then((d) => {
                              if (d) setHistoryDetail(d);
                            });
                          }}
                        >
                          Histórico
                        </button>
                        {row.status !== "CANCELLED" &&
                        row.status !== "PAID" ? (
                          <button
                            type="button"
                            className="ml-3 text-sm text-destructive"
                            onClick={() => setCancelBoleto(row)}
                          >
                            Cancelar
                          </button>
                        ) : null}
                        {row.status === "CANCELLED" ||
                        row.status === "ERROR" ? (
                          <button
                            type="button"
                            className="ml-3 text-sm font-medium text-primary"
                            onClick={() => {
                              void confirmAction({
                                title: "Reemitir boleto?",
                                message:
                                  "Cancela o atual (se necessário) e emite novamente a mesma parcela.",
                                confirmLabel: "Reemitir",
                              }).then((ok) => {
                                if (ok) reissue.mutate(row.id);
                              });
                            }}
                          >
                            Reemitir
                          </button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {eligibleQ.isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : !eligibleQ.data?.length ? (
            <p className="text-muted-foreground">
              Nenhum pedido confirmado a prazo elegível.
            </p>
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Pedido</TableHead>
                    <TableHead className="px-4">Cliente</TableHead>
                    <TableHead className="px-4">Condição</TableHead>
                    <TableHead className="px-4">Total</TableHead>
                    <TableHead className="px-4">Parcelas</TableHead>
                    <TableHead className="px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleQ.data.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="px-4 py-3 font-mono text-xs">
                        {formatOrderCode({
                          id: o.id,
                          orderNumber: o.orderNumber,
                        })}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {o.customer?.name ?? "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {o.paymentCondition?.name ?? "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 tabular-nums">
                        {fmtBrl(o.totalAmount)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {o.alreadyEmitted}/{o.totalInstallments}
                        {o.openInstallments
                          ? ` · ${o.openInstallments} pendente(s)`
                          : ""}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          disabled={!o.canEmit}
                          title={o.issues.join("; ") || undefined}
                          onClick={() => setEmitOrder(o)}
                        >
                          Emitir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <EmitBoletoSheet
        open={Boolean(emitOrder)}
        onOpenChange={(open) => {
          if (!open) setEmitOrder(null);
        }}
        order={emitOrder}
        onDone={(ids) => {
          invalidate();
          void openBoletoPdfs(ids);
        }}
      />
      <EditBoletoSheet
        open={Boolean(editBoleto)}
        onOpenChange={(open) => {
          if (!open) setEditBoleto(null);
        }}
        boleto={editBoleto}
        onDone={(openPdfFlag, id) => {
          invalidate();
          if (openPdfFlag && id) void openPdf(id);
        }}
      />
      <CancelBoletoSheet
        open={Boolean(cancelBoleto)}
        onOpenChange={(open) => {
          if (!open) setCancelBoleto(null);
        }}
        boleto={cancelBoleto}
        onDone={invalidate}
      />
      <BoletoHistorySheet
        open={Boolean(historyDetail)}
        onOpenChange={(open) => {
          if (!open) setHistoryDetail(null);
        }}
        detail={historyDetail}
      />
    </div>
  );
}
