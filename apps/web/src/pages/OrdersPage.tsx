import { useAuth } from "@/auth/AuthContext";
import { useConfirm } from "@/components/confirm";
import { FilterBar, FormField } from "@/components/forms";
import { OrdersKanbanBoard } from "@/components/orders/OrdersKanbanBoard";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch, downloadPdf, printPdf } from "@/lib/api";
import { formatOrderCode, orderCodeFilenamePart } from "@/lib/order-code";
import { formatOrderMoney, statusBadgeClass } from "@/lib/order-kanban";
import { isWebAdmin } from "@/lib/staff";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES, canRead, orderStatusLabel } from "@pedidos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Kanban, List, Printer, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Seller = { id: string; user: { name: string } };

type OrderSituation = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
  mapsToCancel?: boolean;
};

type Order = {
  id: string;
  orderNumber?: number | null;
  status: string;
  situationId?: string | null;
  situation?: OrderSituation | null;
  totalAmount: unknown;
  createdAt: string;
  seller: { user: { name: string } };
  customer: {
    name: string;
    city?: string | null;
    tradeName?: string | null;
    legalName?: string | null;
  } | null;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: unknown;
  }[];
};

function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function statusChangeHint(status: string): string {
  if (status === "CANCELLED") {
    return " Pedidos cancelados podem estornar estoque se estavam confirmados.";
  }
  if (status === "CONFIRMED") {
    return " Confirmar o pedido pode baixar estoque.";
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
  const canPrint80mm = Boolean(
    user && canRead(user.role, "orders_print_80mm", user.permissions),
  );
  const { confirm, alert } = useConfirm();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const view = searchParams.get("view") === "kanban" ? "kanban" : "list";
  const isKanban = view === "kanban";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pdfPending, setPdfPending] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [orderNumber, setOrderNumber] = useState("");
  const [city, setCity] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [sellerId, setSellerId] = useState("");

  const debouncedOrderNumber = useDebouncedValue(orderNumber);
  const debouncedCity = useDebouncedValue(city);
  const debouncedTradeName = useDebouncedValue(tradeName);
  const debouncedLegalName = useDebouncedValue(legalName);

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const { data: situations = [], isPending: situationsPending } = useQuery({
    queryKey: ["admin", "order-situations"],
    queryFn: () => apiFetch<OrderSituation[]>("/admin/order-situations"),
  });

  const listQueryKey = useMemo(
    () => [
      "admin",
      "orders",
      statusFilter ?? "all",
      debouncedOrderNumber.trim(),
      debouncedCity.trim(),
      debouncedTradeName.trim(),
      debouncedLegalName.trim(),
      sellerId,
    ],
    [
      statusFilter,
      debouncedOrderNumber,
      debouncedCity,
      debouncedTradeName,
      debouncedLegalName,
      sellerId,
    ],
  );

  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey: listQueryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const code = debouncedOrderNumber.trim();
      if (code) params.set("orderNumber", code);
      const cityVal = debouncedCity.trim();
      if (cityVal) params.set("city", cityVal);
      const trade = debouncedTradeName.trim();
      if (trade) params.set("tradeName", trade);
      const legal = debouncedLegalName.trim();
      if (legal) params.set("legalName", legal);
      if (sellerId) params.set("sellerId", sellerId);
      const qs = params.toString();
      return apiFetch<Order[]>(`/admin/orders${qs ? `?${qs}` : ""}`);
    },
  });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    statusFilter,
    debouncedOrderNumber,
    debouncedCity,
    debouncedTradeName,
    debouncedLegalName,
    sellerId,
  ]);

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
  }

  function setView(next: "list" | "kanban") {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === "kanban") p.set("view", "kanban");
      else p.delete("view");
      return p;
    });
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

  const patchSituation = useMutation({
    mutationFn: async ({
      orderId,
      situationId,
    }: {
      orderId: string;
      situationId: string | null;
    }) =>
      apiFetch(`/admin/orders/${orderId}/situation`, {
        method: "PATCH",
        body: JSON.stringify({ situationId }),
      }),
    onSuccess: () => invalidateOrders(),
  });

  function situationOptionsFor(order: Order) {
    const active = situations.filter((s) => s.active);
    const current = order.situation;
    const opts = active.map((s) => ({ value: s.id, label: s.name }));
    if (current && !active.some((s) => s.id === current.id)) {
      opts.push({
        value: current.id,
        label: `${current.name} (inativa)`,
      });
    }
    return opts;
  }

  const removeOrder = useMutation({
    mutationFn: (orderId: string) =>
      apiFetch(`/admin/orders/${orderId}`, { method: "DELETE" }),
    onSuccess: () => invalidateOrders(),
  });

  async function applyStatusChange(orderIds: string[], status: string) {
    if (!canWrite || orderIds.length === 0) return;

    const needsConfirm =
      status === "CANCELLED" || orderIds.length > 1 || status === "CONFIRMED";
    if (needsConfirm) {
      const title =
        orderIds.length > 1
          ? `Alterar status de ${orderIds.length} pedidos?`
          : "Alterar status do pedido?";
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
        await downloadPdf(
          `/admin/orders/${o.id}/pdf`,
          `pedido-${orderCodeFilenamePart(o)}.pdf`,
        );
      }
    } catch {
      setActionError("Não foi possível baixar o PDF de um ou mais pedidos.");
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
          description: `${selectedOrders.length} pedidos serão enviados à impressão um a um. Confirme cada diálogo do navegador.`,
          tone: "default",
        });
      }
      for (const o of selectedOrders) {
        await printPdf(`/admin/orders/${o.id}/pdf`);
      }
    } catch {
      setActionError("Não foi possível imprimir um ou mais pedidos.");
    } finally {
      setPdfPending(false);
    }
  }

  async function handlePrint80mm() {
    if (!hasSelection) return;
    setActionError(null);
    setPdfPending(true);
    try {
      if (selectedOrders.length > 1) {
        await alert({
          title: "Impressão 80mm em sequência",
          description: `${selectedOrders.length} cupons 80mm serão enviados à impressão um a um. Confirme cada diálogo do navegador.`,
          tone: "default",
        });
      }
      for (const o of selectedOrders) {
        await printPdf(`/admin/orders/${o.id}/pdf-80mm`);
      }
    } catch {
      setActionError(
        "Não foi possível imprimir o cupom 80mm de um ou mais pedidos.",
      );
    } finally {
      setPdfPending(false);
    }
  }

  const pendingCreditSelected = statusFilter === "PENDING_CREDIT_APPROVAL";
  const statusBusy = patchStatus.isPending;
  const situationBusy = patchSituation.isPending;

  const kanbanHint = canWrite
    ? "Acompanhe rascunho, crédito e a expedição até a entrega. Arraste o card para alterar status ou situação, ou clique para abrir o pedido."
    : "Acompanhe rascunho, crédito e a expedição até a entrega. Clique no card para abrir o pedido.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isKanban
              ? kanbanHint
              : "Liste, filtre, exporte e altere o status dos pedidos sem abrir cada detalhe."}
          </p>
        </div>
        <Tabs
          value={view}
          onValueChange={(v) => setView(v === "kanban" ? "kanban" : "list")}
        >
          <TabsList aria-label="Visualização de pedidos">
            <TabsTrigger value="list">
              <List />
              Lista
            </TabsTrigger>
            <TabsTrigger value="kanban">
              <Kanban />
              Kanban
            </TabsTrigger>
          </TabsList>
        </Tabs>
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

      <FilterBar className="p-4 lg:grid-cols-5">
        <FormField label="Nº do pedido" htmlFor="orders-filter-number">
          <Input
            id="orders-filter-number"
            placeholder="Número"
            inputMode="numeric"
            pattern="[0-9]*"
            value={orderNumber}
            onChange={(e) =>
              setOrderNumber(e.target.value.replace(/\D/g, ""))
            }
          />
        </FormField>
        <FormField label="Cidade" htmlFor="orders-filter-city">
          <Input
            id="orders-filter-city"
            placeholder="Cidade"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </FormField>
        <FormField label="Nome fantasia" htmlFor="orders-filter-trade">
          <Input
            id="orders-filter-trade"
            placeholder="Nome fantasia"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
          />
        </FormField>
        <FormField label="Razão social" htmlFor="orders-filter-legal">
          <Input
            id="orders-filter-legal"
            placeholder="Razão social"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
          />
        </FormField>
        <FormField label="Vendedor" htmlFor="orders-filter-seller">
          <AppSelect
            id="orders-filter-seller"
            value={sellerId}
            onValueChange={setSellerId}
            emptyLabel="Todos"
            placeholder="Todos"
            options={sellers.map((s) => ({
              value: s.id,
              label: s.user.name,
            }))}
          />
        </FormField>
      </FilterBar>

      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}

      {isKanban ? (
        <OrdersKanbanBoard
          orders={orders}
          situations={situations}
          isLoading={isLoading || situationsPending}
          isError={isError}
          canDrag={canWrite && !statusBusy && !situationBusy}
          movingId={
            patchStatus.isPending
              ? (patchStatus.variables?.orderId ?? null)
              : patchSituation.isPending
                ? (patchSituation.variables?.orderId ?? null)
                : null
          }
          onMove={(orderId, move) => {
            if (move.type === "status") {
              void applyStatusChange([orderId], move.status);
              return;
            }
            setActionError(null);
            patchSituation.mutate(
              { orderId, situationId: move.situationId },
              {
                onError: (e) => {
                  setActionError(
                    e instanceof Error
                      ? e.message
                      : "Não foi possível alterar a situação.",
                  );
                },
              },
            );
          }}
        />
      ) : (
        <>
      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {hasSelection
            ? `${selectedOrders.length} pedido(s) selecionado(s)`
            : "Selecione pedidos para exportar, imprimir ou mudar o status"}
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
          {canPrint80mm ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasSelection || pdfPending}
              onClick={() => void handlePrint80mm()}
            >
              <Printer className="size-4" />
              Imprimir 80mm
            </Button>
          ) : null}
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

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : null}

      {isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar os pedidos.
        </p>
      ) : null}

      {!isLoading && !isError && orders.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <ShoppingCart className="h-12 w-12 text-primary/40" />
          <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
        </div>
      ) : null}

      {!isLoading && !isError && orders.length > 0 ? (
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
                <TableHead className="px-4">Número do pedido</TableHead>
                <TableHead className="px-4">Data</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4">Situação</TableHead>
                <TableHead className="px-4">Vendedor</TableHead>
                <TableHead className="px-4">Cliente</TableHead>
                <TableHead className="px-4">Cidade</TableHead>
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
                        aria-label={`Selecionar pedido ${code}`}
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
                      {canWrite ? (
                        <AppSelect
                          value={o.situationId ?? ""}
                          disabled={situationBusy}
                          triggerClassName="w-auto min-w-[9rem]"
                          emptyLabel="Sem situação"
                          options={situationOptionsFor(o)}
                          onValueChange={(v) => {
                            const next = v || null;
                            if (next === (o.situationId ?? null)) return;
                            setActionError(null);
                            patchSituation.mutate(
                              { orderId: o.id, situationId: next },
                              {
                                onError: (e) => {
                                  setActionError(
                                    e instanceof Error
                                      ? e.message
                                      : "Não foi possível alterar a situação.",
                                  );
                                },
                              },
                            );
                          }}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {o.situation?.name ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {o.seller.user.name}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {o.customer?.tradeName?.trim() ||
                        o.customer?.name ||
                        "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {o.customer?.city?.trim() ? o.customer.city : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground tabular-nums">
                      {o.items.length}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatOrderMoney(o.totalAmount)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Link
                        to={`/pedidos/${o.id}`}
                        className="text-primary"
                      >
                        Editar
                      </Link>
                      {canWrite ? (
                        <button
                          type="button"
                          className="ml-3 text-destructive"
                          disabled={removeOrder.isPending}
                          onClick={() => {
                            void confirm({
                              title: "Excluir pedido?",
                              description: `O pedido ${code} será removido permanentemente. Pedidos confirmados estornam estoque ao excluir.`,
                              confirmLabel: "Excluir",
                              tone: "destructive",
                            }).then((ok) => {
                              if (!ok) return;
                              setActionError(null);
                              removeOrder.mutate(o.id, {
                                onError: (e) => {
                                  setActionError(
                                    e instanceof Error
                                      ? e.message
                                      : "Não foi possível excluir o pedido.",
                                  );
                                },
                              });
                            });
                          }}
                        >
                          Excluir
                        </button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}
