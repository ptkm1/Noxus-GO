import { useAuth } from "@/auth/AuthContext";
import { useConfirm } from "@/components/confirm";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
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
import { apiFetch, downloadPdf, printPdf } from "@/lib/api";
import { formatOrderCode } from "@/lib/order-code";
import { isWebAdmin } from "@/lib/staff";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES, orderStatusLabel } from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Printer, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Order = {
  id: string;
  orderNumber?: number | null;
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
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
    case "CANCELLED":
      return "border-transparent bg-destructive/15 text-destructive";
    case "PENDING_CREDIT_APPROVAL":
      return "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

function formatMoney(value: unknown) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusChangeHint(status: string): string {
  if (status === "CANCELLED") {
    return " Pedidos cancelados podem estornar estoque se estavam confirmados.";
  }
  if (status === "CONFIRMED") {
    return " Confirmar a venda pode baixar estoque.";
  }
  return "";
}

function selectAllState(
  allSelected: boolean,
  someSelected: boolean,
): boolean | "indeterminate" {
  if (allSelected) return true;
  if (someSelected) return "indeterminate";
  return false;
}

export function OrdersPage() {
  const { user } = useAuth();
  const canWrite = isWebAdmin(user?.role);
  const { confirm, alert } = useConfirm();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pdfPending, setPdfPending] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

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

  const visibleIds = useMemo(() => orders.map((o) => o.id), [orders]);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allSelected;
  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds],
  );
  const hasSelection = selectedOrders.length > 0;

  function setFilter(next: string | null) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next) p.set("status", next);
      else p.delete("status");
      return p;
    });
    setSelectedIds(new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(visibleIds) : new Set());
  }

  const invalidateOrders = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    void qc.invalidateQueries({ queryKey: ["admin", "pending-credit-summary"] });
    void qc.invalidateQueries({ queryKey: ["admin", "notifications-unread"] });
  };

  const patchStatus = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: string;
    }) =>
      apiFetch(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => invalidateOrders(),
  });

  async function applyStatusChange(orderIds: string[], status: string) {
    if (!canWrite || orderIds.length === 0) return;

    const needsConfirm =
      status === "CANCELLED" || orderIds.length > 1 || status === "CONFIRMED";
    if (needsConfirm) {
      const title =
        orderIds.length > 1
          ? `Alterar status de ${orderIds.length} vendas?`
          : "Alterar status da venda?";
      const ok = await confirm({
        title,
        description: `O status será alterado para “${orderStatusLabel(status)}”.${statusChangeHint(status)}`,
        confirmLabel: "Alterar status",
        tone: status === "CANCELLED" ? "destructive" : "default",
      });
      if (!ok) {
        setBulkStatus("");
        return;
      }
    }

    setActionError(null);
    try {
      for (const orderId of orderIds) {
        await patchStatus.mutateAsync({ orderId, status });
      }
      setBulkStatus("");
      setSelectedIds(new Set());
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Não foi possível alterar o status.",
      );
    }
  }

  async function handleExportPdf() {
    if (!hasSelection) return;
    setActionError(null);
    setPdfPending(true);
    try {
      for (const o of selectedOrders) {
        const code = formatOrderCode(o);
        await downloadPdf(
          `/admin/orders/${o.id}/pdf`,
          `pedido-${code.replace("#", "")}.pdf`,
        );
      }
    } catch {
      setActionError("Não foi possível baixar o PDF de uma ou mais vendas.");
    } finally {
      setPdfPending(false);
    }
  }

  async function handlePrint() {
    if (!hasSelection) return;
    setActionError(null);
    setPdfPending(true);
    try {
      if (selectedOrders.length > 1) {
        await alert({
          title: "Impressão em sequência",
          description: `${selectedOrders.length} vendas serão enviadas à impressão uma a uma. Confirme cada diálogo do navegador.`,
          tone: "default",
        });
      }
      for (const o of selectedOrders) {
        await printPdf(`/admin/orders/${o.id}/pdf`);
      }
    } catch {
      setActionError("Não foi possível imprimir uma ou mais vendas.");
    } finally {
      setPdfPending(false);
    }
  }

  const pendingCreditSelected = statusFilter === "PENDING_CREDIT_APPROVAL";
  const statusBusy = patchStatus.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Vendas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Liste, filtre, exporte e altere o status dos pedidos sem abrir cada
          detalhe.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={!pendingCreditSelected ? "default" : "outline"}
          onClick={() => setFilter(null)}
        >
          Todas
        </Button>
        <Button
          type="button"
          size="sm"
          variant={pendingCreditSelected ? "default" : "outline"}
          className={
            pendingCreditSelected
              ? "bg-amber-600 text-white hover:bg-amber-600/90"
              : undefined
          }
          onClick={() => setFilter("PENDING_CREDIT_APPROVAL")}
        >
          Aguardando crédito
        </Button>
      </div>

      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {hasSelection
            ? `${selectedOrders.length} venda(s) selecionada(s)`
            : "Selecione vendas para exportar, imprimir ou mudar o status"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasSelection || pdfPending}
            onClick={() => void handleExportPdf()}
          >
            <Download className="size-4" />
            {pdfPending ? "Gerando…" : "Exportar PDF"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasSelection || pdfPending}
            onClick={() => void handlePrint()}
          >
            <Printer className="size-4" />
            Imprimir
          </Button>
          {canWrite ? (
            <AppSelect
              value={bulkStatus}
              disabled={!hasSelection || statusBusy}
              placeholder="Alterar status…"
              emptyLabel="Alterar status…"
              triggerClassName="w-[11.5rem]"
              options={ORDER_STATUSES.map((s) => ({
                value: s,
                label: orderStatusLabel(s),
              }))}
              onValueChange={(v) => {
                setBulkStatus(v);
                if (v) void applyStatusChange([...selectedIds], v);
              }}
            />
          ) : null}
        </div>
      </div>

      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : null}

      {!isLoading && orders.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <ShoppingCart className="h-12 w-12 text-primary/40" />
          <p className="text-muted-foreground">Nenhuma venda encontrada.</p>
        </div>
      ) : null}

      {!isLoading && orders.length > 0 ? (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-4">
                  <Checkbox
                    checked={selectAllState(allSelected, someSelected)}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Selecionar todas"
                  />
                </TableHead>
                <TableHead className="px-4">Código</TableHead>
                <TableHead className="px-4">Data</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4">Vendedor</TableHead>
                <TableHead className="px-4">Cliente</TableHead>
                <TableHead className="px-4">Itens</TableHead>
                <TableHead className="px-4 text-right">Total</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const selected = selectedIds.has(o.id);
                const code = formatOrderCode(o);
                return (
                  <TableRow
                    key={o.id}
                    className={cn(selected && "bg-muted/40")}
                  >
                    <TableCell className="px-4 py-3">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(v) => toggleOne(o.id, v === true)}
                        aria-label={`Selecionar venda ${code}`}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium tabular-nums">
                      {code}
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {canWrite ? (
                        <AppSelect
                          value={o.status}
                          disabled={statusBusy}
                          triggerClassName="w-auto min-w-[10.5rem]"
                          options={ORDER_STATUSES.map((s) => ({
                            value: s,
                            label: orderStatusLabel(s),
                          }))}
                          onValueChange={(v) => {
                            if (v !== o.status)
                              void applyStatusChange([o.id], v);
                          }}
                        />
                      ) : (
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(o.status)}
                        >
                          {orderStatusLabel(o.status)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {o.seller.user.name}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {o.customer?.name ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground tabular-nums">
                      {o.items.length}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatMoney(o.totalAmount)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        asChild
                      >
                        <Link to={`/vendas/${o.id}`}>Detalhe</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
