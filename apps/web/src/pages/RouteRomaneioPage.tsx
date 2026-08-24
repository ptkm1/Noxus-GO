import { FilterBar, FormField } from "@/components/forms";
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
import {
  apiFetch,
  downloadPdf,
  fetchAuthenticatedBlob,
  printPdf,
} from "@/lib/api";
import { formatOrderCode } from "@/lib/order-code";
import { cn } from "@/lib/utils";
import {
  groupOrdersByPaymentCondition,
  paymentConditionLabel,
  sumOrderTotals,
  uniqueIdsPreserveOrder,
  type RomaneioPaymentCondition,
} from "@pedidos/shared";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Download, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type Seller = { id: string; user: { name: string } };

type OrderSituation = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

type RouteRomaneioOrder = {
  id: string;
  orderNumber?: number | null;
  status: string;
  situation?: OrderSituation | null;
  totalAmount: unknown;
  createdAt: string;
  customer: {
    name: string;
    city?: string | null;
    tradeName?: string | null;
    legalName?: string | null;
  } | null;
  paymentCondition?: RomaneioPaymentCondition | null;
  items: { id: string; quantity: number }[];
};

function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function formatMoney(value: unknown) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function selectAllState(
  allSelected: boolean,
  someSelected: boolean,
): boolean | "indeterminate" {
  if (allSelected) return true;
  if (someSelected) return "indeterminate";
  return false;
}

function customerLabel(o: RouteRomaneioOrder): string {
  return (
    o.customer?.tradeName?.trim() ||
    o.customer?.legalName?.trim() ||
    o.customer?.name ||
    "—"
  );
}

function itemQty(o: RouteRomaneioOrder): number {
  return o.items.reduce((s, it) => s + (it.quantity || 0), 0);
}

function romaneioPdfRequest(
  orderIds: string[],
  routeName: string,
  driverName: string,
): { path: string; init?: RequestInit } {
  const q = new URLSearchParams();
  q.set("orderIds", orderIds.join(","));
  if (routeName.trim()) q.set("routeName", routeName.trim());
  if (driverName.trim()) q.set("driverName", driverName.trim());
  const path = `/admin/reports/route-romaneio.pdf?${q.toString()}`;
  if (path.length < 1800) return { path };
  return {
    path: "/admin/reports/route-romaneio.pdf",
    init: {
      method: "POST",
      body: JSON.stringify({
        orderIds,
        ...(routeName.trim() ? { routeName: routeName.trim() } : {}),
        ...(driverName.trim() ? { driverName: driverName.trim() } : {}),
      }),
    },
  };
}

export function RouteRomaneioPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [city, setCity] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [situationId, setSituationId] = useState("");
  const [routeName, setRouteName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const debouncedOrderNumber = useDebouncedValue(orderNumber);
  const debouncedCity = useDebouncedValue(city);
  const debouncedTradeName = useDebouncedValue(tradeName);

  const { data: sellers = [] } = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => apiFetch<Seller[]>("/admin/sellers"),
  });

  const { data: situations = [] } = useQuery({
    queryKey: ["admin", "order-situations"],
    queryFn: () => apiFetch<OrderSituation[]>("/admin/order-situations"),
  });

  const listQueryKey = useMemo(
    () => [
      "admin",
      "orders",
      "romaneio",
      debouncedOrderNumber.trim(),
      debouncedCity.trim(),
      debouncedTradeName.trim(),
      sellerId,
      situationId,
    ],
    [
      debouncedOrderNumber,
      debouncedCity,
      debouncedTradeName,
      sellerId,
      situationId,
    ],
  );

  const { data: orders = [], isLoading } = useQuery({
    queryKey: listQueryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      const code = debouncedOrderNumber.trim();
      if (code) params.set("orderNumber", code);
      const cityVal = debouncedCity.trim();
      if (cityVal) params.set("city", cityVal);
      const trade = debouncedTradeName.trim();
      if (trade) params.set("tradeName", trade);
      if (sellerId) params.set("sellerId", sellerId);
      if (situationId) params.set("situationId", situationId);
      const qs = params.toString();
      const path = qs ? `/admin/orders?${qs}` : "/admin/orders";
      return apiFetch<RouteRomaneioOrder[]>(path);
    },
  });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [listQueryKey]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const visibleIds = useMemo(() => orders.map((o) => o.id), [orders]);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allSelected;

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds],
  );

  const summary = useMemo(() => {
    const totals = selectedOrders.map((o) => ({
      id: o.id,
      totalAmount: Number(o.totalAmount),
      paymentCondition: o.paymentCondition ?? null,
    }));
    return {
      count: totals.length,
      total: sumOrderTotals(totals),
      groups: groupOrdersByPaymentCondition(totals),
    };
  }, [selectedOrders]);

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

  async function generate() {
    const orderIds = uniqueIdsPreserveOrder([...selectedIds]);
    if (orderIds.length === 0) return;
    setErr(null);
    setPending(true);
    try {
      const req = romaneioPdfRequest(orderIds, routeName, driverName);
      const blob = await fetchAuthenticatedBlob(req.path, req.init);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao gerar romaneio");
    } finally {
      setPending(false);
    }
  }

  async function handleDownload() {
    const orderIds = uniqueIdsPreserveOrder([...selectedIds]);
    if (orderIds.length === 0) return;
    const req = romaneioPdfRequest(orderIds, routeName, driverName);
    await downloadPdf(req.path, "romaneio-rota.pdf", req.init);
  }

  async function handlePrint() {
    const orderIds = uniqueIdsPreserveOrder([...selectedIds]);
    if (orderIds.length === 0) return;
    const req = romaneioPdfRequest(orderIds, routeName, driverName);
    await printPdf(req.path, req.init);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Romaneio de rota
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione os pedidos da carga, confira os totais por condição de
          pagamento e gere o documento para impressão e conferência.
        </p>
      </div>

      <FilterBar className="p-4 lg:grid-cols-5">
        <FormField label="Nº do pedido" htmlFor="romaneio-number">
          <Input
            id="romaneio-number"
            placeholder="Número"
            inputMode="numeric"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.replace(/\D/g, ""))}
          />
        </FormField>
        <FormField label="Cidade" htmlFor="romaneio-city">
          <Input
            id="romaneio-city"
            placeholder="Cidade"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </FormField>
        <FormField label="Cliente" htmlFor="romaneio-trade">
          <Input
            id="romaneio-trade"
            placeholder="Nome fantasia"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
          />
        </FormField>
        <FormField label="Vendedor" htmlFor="romaneio-seller">
          <AppSelect
            id="romaneio-seller"
            value={sellerId}
            onValueChange={setSellerId}
            emptyLabel="Todos"
            options={sellers.map((s) => ({
              value: s.id,
              label: s.user.name,
            }))}
          />
        </FormField>
        {situations.length > 0 ? (
          <FormField label="Etapa" htmlFor="romaneio-situation">
            <AppSelect
              id="romaneio-situation"
              value={situationId}
              onValueChange={setSituationId}
              emptyLabel="Todas"
              options={situations.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
            />
          </FormField>
        ) : null}
      </FilterBar>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4 min-w-0">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : null}
          {!isLoading && orders.length === 0 ? (
            <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <ClipboardList className="h-12 w-12 text-primary/40" />
              <p className="text-muted-foreground">
                Nenhum pedido encontrado com os filtros atuais.
              </p>
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
                        aria-label="Selecionar todos os pedidos exibidos"
                      />
                    </TableHead>
                    <TableHead className="px-4">Pedido</TableHead>
                    <TableHead className="px-4">Cliente</TableHead>
                    <TableHead className="px-4">Cidade</TableHead>
                    <TableHead className="px-4">Data</TableHead>
                    <TableHead className="px-4">Condição</TableHead>
                    <TableHead className="px-4 text-right">Itens</TableHead>
                    <TableHead className="px-4">Etapa</TableHead>
                    <TableHead className="px-4 text-right">Valor</TableHead>
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
                          <Link
                            to={`/pedidos/${o.id}`}
                            className="text-primary hover:underline"
                          >
                            {code}
                          </Link>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {customerLabel(o)}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {o.customer?.city?.trim() || "—"}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          {paymentConditionLabel(o.paymentCondition ?? null)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {itemQty(o)}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge variant="outline">
                            {o.situation?.name ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatMoney(o.totalAmount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 h-fit">
          <div className="surface-card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Resumo da seleção</h2>
            <p className="text-sm">
              Pedidos selecionados:{" "}
              <strong className="tabular-nums">{summary.count}</strong>
            </p>
            <p className="text-sm">
              Valor total:{" "}
              <strong className="tabular-nums">
                {formatMoney(summary.total)}
              </strong>
            </p>
            {summary.groups.length > 0 ? (
              <ul className="space-y-1 border-t border-border pt-3 text-sm">
                {summary.groups.map((g) => (
                  <li key={g.key} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{g.label}</span>
                    <span className="tabular-nums font-medium">
                      {formatMoney(g.total)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                À vista: {formatMoney(0)}
              </p>
            )}
          </div>

          <div className="surface-card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Documento</h2>
            <FormField label="Rota (opcional)" htmlFor="romaneio-rota">
              <Input
                id="romaneio-rota"
                placeholder="Nome ou código da rota"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
              />
            </FormField>
            <FormField
              label="Motorista (opcional)"
              htmlFor="romaneio-motorista"
            >
              <Input
                id="romaneio-motorista"
                placeholder="Nome para conferência"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </FormField>
            <Button
              type="button"
              className="w-full"
              disabled={summary.count === 0 || pending}
              onClick={() => void generate()}
            >
              {pending ? "Gerando…" : "Gerar romaneio"}
            </Button>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
          </div>
        </aside>
      </div>

      {previewUrl ? (
        <div className="surface-card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Romaneio gerado</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handlePrint()}
              >
                <Printer className="size-4" />
                Imprimir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleDownload()}
              >
                <Download className="size-4" />
                Baixar PDF
              </Button>
            </div>
          </div>
          <iframe
            title="Pré-visualização do romaneio"
            src={previewUrl}
            className="h-[70vh] w-full rounded-md border border-border bg-white"
          />
        </div>
      ) : null}
    </div>
  );
}
